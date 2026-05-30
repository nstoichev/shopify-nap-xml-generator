/**
 * Shared formatting and parsing helpers.
 */

/**
 * Round a number to a fixed number of decimal places.
 */
export function roundTo(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

/**
 * Format a number as a decimal string with exactly two fractional digits.
 */
export function formatDecimal(value) {
  return roundTo(value, 2).toFixed(2);
}

/**
 * Parse a Shopify / CSV date string into ISO date (YYYY-MM-DD).
 * Supports ISO strings, "YYYY-MM-DD", and "DD/MM/YYYY HH:MM".
 */
export function parseDate(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // Already ISO date or datetime
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // DD/MM/YYYY with optional time
  const euMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (euMatch) {
    const day = euMatch[1].padStart(2, '0');
    const month = euMatch[2].padStart(2, '0');
    const year = euMatch[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Extract digits from a string and return as integer, or fallback value.
 */
export function extractInteger(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const digits = String(value).replace(/\D/g, '');
  if (!digits) {
    return fallback;
  }

  const num = parseInt(digits, 10);
  return Number.isNaN(num) ? fallback : num;
}

/**
 * Safely parse a numeric CSV value.
 */
export function parseNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const normalized = String(value).replace(/,/g, '').trim();
  const num = parseFloat(normalized);
  return Number.isNaN(num) ? fallback : num;
}

/**
 * Normalize a CSV header for flexible column matching.
 */
export function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Find the first matching column value from a row using candidate header names.
 */
export function getColumnValue(row, candidates) {
  const normalizedRow = {};

  for (const [key, value] of Object.entries(row)) {
    normalizedRow[normalizeHeader(key)] = value;
  }

  for (const candidate of candidates) {
    const normalized = normalizeHeader(candidate);
    if (Object.prototype.hasOwnProperty.call(normalizedRow, normalized)) {
      return normalizedRow[normalized];
    }
  }

  return undefined;
}

/**
 * Truncate a string to a maximum length.
 */
export function truncate(value, maxLength) {
  const str = String(value ?? '');
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength);
}

/**
 * Get today's date as YYYY-MM-DD.
 */
export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Derive two-digit month and four-digit year from an ISO date string.
 */
export function monthYearFromDate(isoDate) {
  if (!isoDate) {
    return { mon: null, god: null };
  }

  const [year, month] = isoDate.split('-');
  return {
    mon: month,
    god: parseInt(year, 10),
  };
}

/**
 * Trigger a browser download for text content.
 */
export function downloadTextFile(content, filename, mimeType = 'application/xml') {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
