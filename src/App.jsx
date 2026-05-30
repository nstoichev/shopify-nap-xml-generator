import { useState } from 'react';
import FileUploader from './components/FileUploader.jsx';
import ValidationResults from './components/ValidationResults.jsx';
import DownloadButton from './components/DownloadButton.jsx';
import { parseShopifyCsv } from './services/csvParser.js';
import { mapShopifyToAudit, validateShopConfig } from './services/shopifyMapper.js';
import { generateAuditXml, buildXmlFilename } from './services/xmlGenerator.js';
import { validateAuditXml, validateAuditModel } from './services/xmlValidator.js';
import { todayIsoDate } from './utils/helpers.js';
import './App.css';

const DEFAULT_SHOP_CONFIG = {
  eik: '',
  e_shop_n: '',
  domain_name: '',
  e_shop_type: '1',
  creation_date: todayIsoDate(),
  mon: '',
  god: '',
};

export default function App() {
  const [shopConfig, setShopConfig] = useState(DEFAULT_SHOP_CONFIG);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [parseErrors, setParseErrors] = useState([]);
  const [mappingErrors, setMappingErrors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [xmlContent, setXmlContent] = useState('');
  const [validation, setValidation] = useState(null);
  const [filename, setFilename] = useState('orders.xml');
  const [selectedFileName, setSelectedFileName] = useState('');

  function handleConfigChange(field, value) {
    setShopConfig((prev) => ({ ...prev, [field]: value }));
  }

  async function handleFileSelect(file) {
    setError('');
    setProcessing(true);
    setSelectedFileName(file.name);
    setParseErrors([]);
    setMappingErrors([]);
    setSummary(null);
    setXmlContent('');
    setValidation(null);

    try {
      const configErrors = validateShopConfig(shopConfig);
      if (configErrors.length > 0) {
        throw new Error(configErrors.join(' '));
      }

      const { rows, errors: csvWarnings } = await parseShopifyCsv(file);
      setParseErrors(csvWarnings);

      const { audit, summary: mapSummary, errors: mapErrors } = mapShopifyToAudit(rows, shopConfig);
      setMappingErrors(mapErrors);
      setSummary(mapSummary);

      const modelErrors = validateAuditModel(audit);
      if (modelErrors.length > 0) {
        throw new Error(modelErrors.join(' '));
      }

      const xml = generateAuditXml(audit);
      const xmlValidation = validateAuditXml(xml);

      setXmlContent(xml);
      setValidation(xmlValidation);
      setFilename(buildXmlFilename(audit));
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setProcessing(false);
    }
  }

  const canDownload = Boolean(xmlContent) && validation?.valid;

  return (
    <div className="app">
      <header className="app-header">
        <h1>NAP XML Generator</h1>
        <p className="app-subtitle">
          Generate Bulgarian NRA (NAP) audit XML from Shopify CSV exports — entirely in your browser.
        </p>
      </header>

      <main className="app-main">
        <section className="card">
          <h2>Shop configuration</h2>
          <p className="section-help">
            Required audit header fields from NAP documentation. These values are not included in Shopify CSV exports.
          </p>
          <div className="form-grid">
            <label>
              EIK (9–13 digits)
              <input
                type="text"
                value={shopConfig.eik}
                onChange={(e) => handleConfigChange('eik', e.target.value)}
                placeholder="123456789"
                maxLength={13}
              />
            </label>
            <label>
              E-shop number (e_shop_n)
              <input
                type="text"
                value={shopConfig.e_shop_n}
                onChange={(e) => handleConfigChange('e_shop_n', e.target.value)}
                placeholder="RF0000001"
                maxLength={10}
              />
            </label>
            <label>
              Domain name
              <input
                type="text"
                value={shopConfig.domain_name}
                onChange={(e) => handleConfigChange('domain_name', e.target.value)}
                placeholder="example.com"
              />
            </label>
            <label>
              E-shop type
              <select
                value={shopConfig.e_shop_type}
                onChange={(e) => handleConfigChange('e_shop_type', e.target.value)}
              >
                <option value="1">1 — Own domain</option>
                <option value="2">2 — Online platform (e.g. Shopify)</option>
              </select>
            </label>
            <label>
              File creation date
              <input
                type="date"
                value={shopConfig.creation_date}
                onChange={(e) => handleConfigChange('creation_date', e.target.value)}
              />
            </label>
            <label>
              Report month (optional)
              <input
                type="text"
                value={shopConfig.mon}
                onChange={(e) => handleConfigChange('mon', e.target.value)}
                placeholder="04"
                maxLength={2}
              />
            </label>
            <label>
              Report year (optional)
              <input
                type="text"
                value={shopConfig.god}
                onChange={(e) => handleConfigChange('god', e.target.value)}
                placeholder="2026"
                maxLength={4}
              />
            </label>
          </div>
        </section>

        <section className="card">
          <h2>1. Upload Shopify CSV</h2>
          <FileUploader onFileSelect={handleFileSelect} disabled={processing} />
          {selectedFileName && (
            <p className="file-name">
              Selected file: <strong>{selectedFileName}</strong>
            </p>
          )}
          {processing && <p className="processing">Processing…</p>}
          {error && <div className="alert alert--error">{error}</div>}
        </section>

        <section className="card">
          <h2>2. Processing Summary</h2>
          {summary ? (
            <dl className="summary-grid">
              <div>
                <dt>Total orders found</dt>
                <dd>{summary.totalOrdersFound}</dd>
              </div>
              <div>
                <dt>Orders successfully mapped</dt>
                <dd>{summary.ordersMapped}</dd>
              </div>
              <div>
                <dt>Returned orders</dt>
                <dd>{summary.returnedOrders}</dd>
              </div>
              <div>
                <dt>Report period</dt>
                <dd>
                  {summary.reportMonth}/{summary.reportYear}
                </dd>
              </div>
              <div>
                <dt>Validation status</dt>
                <dd>{validation?.valid ? 'Valid' : validation ? 'Invalid' : '—'}</dd>
              </div>
            </dl>
          ) : (
            <p className="placeholder">Upload a CSV to see processing results.</p>
          )}

          <ValidationResults
            validation={validation}
            mappingErrors={mappingErrors}
            parseErrors={parseErrors}
          />
        </section>

        <section className="card">
          <h2>3. XML Preview</h2>
          <pre className="xml-preview">{xmlContent || 'Generated XML will appear here.'}</pre>
        </section>

        <section className="card card--actions">
          <h2>4. Download</h2>
          <DownloadButton xmlContent={xmlContent} filename={filename} disabled={!canDownload} />
          {!canDownload && xmlContent && (
            <p className="section-help">Fix validation errors before downloading.</p>
          )}
        </section>
      </main>

      <footer className="app-footer">
        <p>All data is processed locally. Nothing is uploaded to a server.</p>
      </footer>
    </div>
  );
}
