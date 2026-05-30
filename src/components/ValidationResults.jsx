/**
 * Display XML validation results and mapping warnings.
 */
export default function ValidationResults({ validation, mappingErrors, parseErrors }) {
  const hasMappingErrors = mappingErrors?.length > 0;
  const hasParseErrors = parseErrors?.length > 0;
  const hasValidationErrors = validation?.errors?.length > 0;
  const hasWarnings = validation?.warnings?.length > 0;

  if (!validation && !hasMappingErrors && !hasParseErrors) {
    return null;
  }

  return (
    <div className="validation-results">
      {validation && (
        <div className={`status-badge ${validation.valid ? 'status-badge--success' : 'status-badge--error'}`}>
          {validation.valid ? 'Validation passed' : 'Validation failed'}
        </div>
      )}

      {hasParseErrors && (
        <MessageList title="CSV warnings" items={parseErrors} type="warning" />
      )}

      {hasMappingErrors && (
        <MessageList title="Mapping issues" items={mappingErrors} type="warning" />
      )}

      {hasValidationErrors && (
        <MessageList title="Validation errors" items={validation.errors} type="error" />
      )}

      {hasWarnings && (
        <MessageList title="Validation warnings" items={validation.warnings} type="warning" />
      )}
    </div>
  );
}

function MessageList({ title, items, type }) {
  return (
    <div className={`message-list message-list--${type}`}>
      <h4>{title}</h4>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
