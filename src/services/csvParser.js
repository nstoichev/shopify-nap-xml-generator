import Papa from 'papaparse';
import { normalizeHeader } from '../utils/helpers.js';
import { SHOPIFY_COLUMNS } from '../utils/schema.js';

/**
 * Minimum columns needed to build NAP orders from a Shopify export.
 */
const REQUIRED_COLUMN_GROUPS = [
  { key: 'orderName', candidates: SHOPIFY_COLUMNS.orderName },
  { key: 'createdAt', candidates: SHOPIFY_COLUMNS.createdAt },
  { key: 'lineItemName', candidates: SHOPIFY_COLUMNS.lineItemName },
];

/**
 * Parse a Shopify CSV file in the browser.
 *
 * @param {File} file - Uploaded CSV file
 * @returns {Promise<{ rows: object[], headers: string[], errors: string[] }>}
 */
export function parseShopifyCsv(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file selected.'));
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      reject(new Error('Please upload a CSV file exported from Shopify.'));
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const errors = [];

        if (results.errors?.length) {
          for (const err of results.errors) {
            errors.push(`CSV parse error at row ${err.row ?? '?'}: ${err.message}`);
          }
        }

        const rows = (results.data || []).filter((row) =>
          Object.values(row).some((value) => String(value ?? '').trim() !== '')
        );

        if (rows.length === 0) {
          reject(new Error('The CSV file is empty or contains no data rows.'));
          return;
        }

        const headers = results.meta?.fields || Object.keys(rows[0] || {});
        const missingColumns = findMissingColumns(headers);

        if (missingColumns.length > 0) {
          reject(
            new Error(
              `Missing required Shopify columns: ${missingColumns.join(', ')}. ` +
                'Export orders from Shopify Admin with line item details.'
            )
          );
          return;
        }

        resolve({
          rows,
          headers,
          errors,
        });
      },
      error: (error) => {
        reject(new Error(`Failed to read CSV file: ${error.message}`));
      },
    });
  });
}

/**
 * Check whether required Shopify column groups exist in the CSV headers.
 */
function findMissingColumns(headers) {
  const normalizedHeaders = new Set(headers.map(normalizeHeader));
  const missing = [];

  for (const group of REQUIRED_COLUMN_GROUPS) {
    const found = group.candidates.some((candidate) =>
      normalizedHeaders.has(normalizeHeader(candidate))
    );

    if (!found) {
      missing.push(group.candidates[0]);
    }
  }

  return missing;
}
