/**
 * CSV file upload control with drag-and-drop support.
 */
export default function FileUploader({ onFileSelect, disabled, accept = '.csv' }) {
  function handleChange(event) {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    if (disabled) {
      return;
    }

    const file = event.dataTransfer.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  return (
    <div
      className={`upload-zone ${disabled ? 'upload-zone--disabled' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input
        id="csv-upload"
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        className="upload-zone__input"
      />
      <label htmlFor="csv-upload" className="upload-zone__label">
        <span className="upload-zone__title">Drop Shopify CSV here</span>
        <span className="upload-zone__hint">or click to browse</span>
      </label>
    </div>
  );
}
