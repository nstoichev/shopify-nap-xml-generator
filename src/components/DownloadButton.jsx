import { downloadTextFile } from '../utils/helpers.js';

/**
 * Download button for the generated XML file.
 */
export default function DownloadButton({ xmlContent, filename, disabled }) {
  function handleDownload() {
    if (!xmlContent || disabled) {
      return;
    }
    downloadTextFile(xmlContent, filename || 'orders.xml');
  }

  return (
    <button
      type="button"
      className="btn btn--primary"
      onClick={handleDownload}
      disabled={disabled || !xmlContent}
    >
      Download XML
    </button>
  );
}
