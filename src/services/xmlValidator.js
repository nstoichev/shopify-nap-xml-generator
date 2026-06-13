import { AUDIT_SCHEMA } from '../utils/schema.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_PATTERN = /^-?\d+(\.\d{1,2})?$/;

/**
 * Validate generated XML against rules derived from dec_audit.xsd.
 *
 * @param {string} xmlString - Generated XML
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateAuditXml(xmlString) {
  const errors = [];
  const warnings = [];

  if (!xmlString || !xmlString.trim()) {
    return {
      valid: false,
      errors: ['XML content is empty.'],
      warnings,
    };
  }

  let doc;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlString, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return {
        valid: false,
        errors: ['Generated XML is not well-formed.'],
        warnings,
      };
    }
  } catch (error) {
    return {
      valid: false,
      errors: [`XML parsing failed: ${error.message}`],
      warnings,
    };
  }

  const audit = doc.documentElement;
  if (!audit || audit.nodeName !== AUDIT_SCHEMA.root) {
    errors.push(`Root element must be <${AUDIT_SCHEMA.root}>.`);
    return { valid: false, errors, warnings };
  }

  validateComplexElement(audit, 'audit', '', errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a complex XML element and its children recursively.
 */
function validateComplexElement(element, schemaKey, path, errors, warnings) {
  const schema = AUDIT_SCHEMA.elements[schemaKey];
  if (!schema) {
    return;
  }

  const currentPath = path || schemaKey;

  if (schema.type !== 'complex') {
    validateSimpleValue(element.textContent, schema, currentPath, errors);
    return;
  }

  const childElements = Array.from(element.children);
  const childCounts = countChildren(childElements);

  // Required direct children
  for (const childName of schema.children || []) {
    const childSchema = AUDIT_SCHEMA.elements[childName];
    const count = childCounts[childName] || 0;
    const minCount = schema.minChildren?.[childName] ?? 1;

    if (count < minCount) {
      errors.push(`Missing required element <${childName}> at ${currentPath}.`);
      continue;
    }

    const nodes = childElements.filter((node) => node.nodeName === childName);
    for (let index = 0; index < nodes.length; index += 1) {
      const nodePath = `${currentPath}/${childName}[${index + 1}]`;
      validateComplexElement(nodes[index], childName, nodePath, errors, warnings);
    }
  }

  // Optional children – validate when present
  for (const childName of schema.optionalChildren || []) {
    const nodes = childElements.filter((node) => node.nodeName === childName);
    for (let index = 0; index < nodes.length; index += 1) {
      const nodePath = `${currentPath}/${childName}[${index + 1}]`;
      validateComplexElement(nodes[index], childName, nodePath, errors, warnings);
    }
  }

  // Detect unexpected child element names
  const allowed = new Set([
    ...(schema.children || []),
    ...(schema.optionalChildren || []),
  ]);

  for (const child of childElements) {
    if (!allowed.has(child.nodeName)) {
      warnings.push(`Unexpected element <${child.nodeName}> at ${currentPath}.`);
    }
  }
}

/**
 * Validate leaf node value against schema type rules.
 */
function validateSimpleValue(value, schema, path, errors) {
  const text = String(value ?? '').trim();
  const label = schema.label || path;

  if (schema.required !== false && schema.optional !== true && text === '') {
    errors.push(`${label} is required at ${path}.`);
    return;
  }

  if (text === '') {
    return;
  }

  if (schema.maxLength && text.length > schema.maxLength) {
    errors.push(`${label} exceeds max length ${schema.maxLength} at ${path}.`);
  }

  if (schema.minLength && text.length < schema.minLength) {
    errors.push(`${label} must be at least ${schema.minLength} characters at ${path}.`);
  }

  switch (schema.type) {
    case 'date':
      if (!DATE_PATTERN.test(text)) {
        errors.push(`${label} must be a date (YYYY-MM-DD) at ${path}, got "${text}".`);
      }
      break;

    case 'month':
      if (!schema.enum.includes(text)) {
        errors.push(`${label} must be a valid month (01-12) at ${path}, got "${text}".`);
      }
      break;

    case 'year': {
      const year = parseInt(text, 10);
      if (Number.isNaN(year) || text.length !== 4 || year < (schema.min ?? 0)) {
        errors.push(`${label} must be a valid year at ${path}, got "${text}".`);
      }
      break;
    }

    case 'integer': {
      if (!/^-?\d+$/.test(text)) {
        errors.push(`${label} must be an integer at ${path}, got "${text}".`);
        break;
      }
      const intVal = parseInt(text, 10);
      if (schema.enum && !schema.enum.includes(intVal)) {
        errors.push(`${label} must be one of [${schema.enum.join(', ')}] at ${path}, got ${intVal}.`);
      }
      if (schema.digitLength !== undefined && text.replace(/^-/, '').length !== schema.digitLength) {
        errors.push(`${label} must be ${schema.digitLength} digits at ${path}, got "${text}".`);
      }
      if (schema.min !== undefined && intVal < schema.min) {
        errors.push(`${label} must be >= ${schema.min} at ${path}.`);
      }
      if (schema.max !== undefined && intVal > schema.max) {
        errors.push(`${label} must be <= ${schema.max} at ${path}.`);
      }
      break;
    }

    case 'decimal':
      if (!DECIMAL_PATTERN.test(text)) {
        errors.push(`${label} must be a decimal with up to 2 fractional digits at ${path}, got "${text}".`);
        break;
      }
      if (schema.fractionDigits !== undefined) {
        const parts = text.split('.');
        const fraction = parts[1] || '';
        if (fraction.length > schema.fractionDigits) {
          errors.push(`${label} must have at most ${schema.fractionDigits} decimal places at ${path}.`);
        }
      }
      break;

    default:
      break;
  }
}

function countChildren(elements) {
  return elements.reduce((acc, node) => {
    acc[node.nodeName] = (acc[node.nodeName] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Validate the internal audit model before XML generation.
 *
 * @param {object} auditModel
 * @param {{ allowEmptyOrders?: boolean }} options
 */
export function validateAuditModel(auditModel, options = {}) {
  const { allowEmptyOrders = false } = options;
  const errors = [];

  if (!auditModel) {
    return ['Audit model is missing.'];
  }

  const headerFields = ['eik', 'e_shop_n', 'domain_name', 'e_shop_type', 'creation_date', 'mon', 'god'];
  for (const field of headerFields) {
    if (auditModel[field] === undefined || auditModel[field] === '') {
      errors.push(`Missing audit header field: ${field}.`);
    }
  }

  if (!allowEmptyOrders && !auditModel.orders?.length) {
    errors.push('At least one order is required.');
  }

  return errors;
}
