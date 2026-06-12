import {
  extractInteger,
  formatDecimal,
  getColumnValue,
  monthYearFromDate,
  parseDate,
  parseNumber,
  roundTo,
  truncate,
} from '../utils/helpers.js';
import { SHOPIFY_COLUMNS } from '../utils/schema.js';

const DEFAULT_VAT_RATE = 20;

/**
 * Map Shopify payment method text to NAP paym code (1-6).
 */
const PAYMENT_METHOD_MAP = [
  { pattern: /cash on delivery|cod|наложен/i, code: 3 },
  { pattern: /shopify payments|credit card|card|visa|mastercard|stripe|paypal/i, code: 4 },
  { pattern: /virtual pos|pos terminal|pos/i, code: 2 },
  { pattern: /bank transfer|wire|iban/i, code: 1 },
  { pattern: /cash|fiscal|bon/i, code: 6 },
];

/**
 * Map refund context to NAP r_paym code (1-4).
 */
function mapRefundPaymentMethod(paymentMethodText) {
  const text = String(paymentMethodText || '').toLowerCase();

  if (/card|visa|mastercard|stripe|paypal/i.test(text)) {
    return 2;
  }
  if (/cash|bon/i.test(text)) {
    return 3;
  }
  if (/bank|iban|transfer|account/i.test(text)) {
    return 1;
  }

  return 4;
}

/**
 * Convert Shopify payment text to NAP paym integer.
 */
export function mapPaymentMethod(paymentMethodText) {
  const text = String(paymentMethodText || '').trim();

  for (const entry of PAYMENT_METHOD_MAP) {
    if (entry.pattern.test(text)) {
      return entry.code;
    }
  }

  return 5;
}

/**
 * Build VAT breakdown for a line item.
 * Shopify prices are treated as VAT-inclusive (typical B2C setup).
 */
function buildArticleFromLineItem(row, vatRate = DEFAULT_VAT_RATE) {
  const name = getColumnValue(row, SHOPIFY_COLUMNS.lineItemName);
  const quantity = parseNumber(getColumnValue(row, SHOPIFY_COLUMNS.lineItemQuantity), 1);
  const unitPriceWithVat = parseNumber(getColumnValue(row, SHOPIFY_COLUMNS.lineItemPrice), 0);

  if (!name || quantity <= 0) {
    return null;
  }

  const lineTotalWithVat = roundTo(unitPriceWithVat * quantity);
  const lineVat = roundTo((lineTotalWithVat * vatRate) / (100 + vatRate));
  const lineTotalWithoutVat = roundTo(lineTotalWithVat - lineVat);
  const unitPriceWithoutVat = quantity > 0 ? roundTo(lineTotalWithoutVat / quantity) : 0;

  return {
    art_name: truncate(name, 200),
    art_quant: formatDecimal(quantity),
    art_price: formatDecimal(unitPriceWithoutVat),
    art_vat_rate: vatRate,
    art_vat: formatDecimal(lineVat),
    art_sum: formatDecimal(lineTotalWithVat),
  };
}

/**
 * Group flat Shopify CSV rows by order name/number.
 */
function groupRowsByOrder(rows) {
  const groups = new Map();

  for (const row of rows) {
    const orderName = getColumnValue(row, SHOPIFY_COLUMNS.orderName);
    if (!orderName) {
      continue;
    }

    const key = String(orderName).trim();
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  return groups;
}

/**
 * Map one grouped Shopify order into the internal NAP order model.
 */
function mapOrderGroup(orderName, rows, mappingErrors) {
  const firstRow = rows[0];
  const createdAt = getColumnValue(firstRow, SHOPIFY_COLUMNS.createdAt);
  const orderDate = parseDate(createdAt);

  if (!orderDate) {
    mappingErrors.push(`Order "${orderName}": invalid or missing order date.`);
    return null;
  }

  const articles = [];

  for (const row of rows) {
    const article = buildArticleFromLineItem(row);
    if (article) {
      articles.push(article);
    }
  }

  if (articles.length === 0) {
    mappingErrors.push(`Order "${orderName}": no valid line items found.`);
    return null;
  }

  const subtotal = parseNumber(getColumnValue(firstRow, SHOPIFY_COLUMNS.subtotal));
  const taxes = parseNumber(getColumnValue(firstRow, SHOPIFY_COLUMNS.taxes));
  const total = parseNumber(getColumnValue(firstRow, SHOPIFY_COLUMNS.total));
  const discount = parseNumber(getColumnValue(firstRow, SHOPIFY_COLUMNS.discountAmount));

  let ordTotal2 = total > 0 ? total : articles.reduce((sum, item) => sum + parseNumber(item.art_sum), 0);
  let ordVat = taxes > 0 ? taxes : articles.reduce((sum, item) => sum + parseNumber(item.art_vat), 0);
  let ordTotal1 =
    subtotal > 0 ? subtotal : articles.reduce((sum, item) => sum + parseNumber(item.art_price) * parseNumber(item.art_quant), 0);

  ordTotal1 = roundTo(ordTotal1);
  ordVat = roundTo(ordVat);
  ordTotal2 = roundTo(ordTotal2);
  const ordDisc = roundTo(discount);

  const paymentMethod = getColumnValue(firstRow, SHOPIFY_COLUMNS.paymentMethod);
  const paym = mapPaymentMethod(paymentMethod);

  const docNumber = extractInteger(orderName, Date.now() % 1000000000);

  return {
    ord_n: truncate(String(orderName).replace(/^#/, ''), 300),
    ord_d: orderDate,
    doc_n: docNumber,
    doc_date: orderDate,
    articles,
    ord_total1: formatDecimal(ordTotal1),
    ord_disc: formatDecimal(ordDisc),
    ord_vat: formatDecimal(ordVat),
    ord_total2: formatDecimal(ordTotal2),
    paym,
    pos_n: '',
    trans_n: '',
    proc_id: '',
    _meta: {
      financialStatus: getColumnValue(firstRow, SHOPIFY_COLUMNS.financialStatus),
      paymentMethod,
    },
  };
}

/**
 * Detect refunded orders and map them to NAP return structure.
 */
function mapReturnedOrders(orders) {
  const returned = [];

  for (const order of orders) {
    const status = String(order._meta?.financialStatus || '').toLowerCase();
    const isRefunded = status.includes('refund') || status.includes('void');

    if (!isRefunded) {
      continue;
    }

    returned.push({
      r_ord_n: order.ord_n,
      r_amount: order.ord_total2,
      r_date: order.ord_d,
      r_paym: mapRefundPaymentMethod(order._meta?.paymentMethod),
    });
  }

  return returned;
}

/**
 * Map Shopify CSV rows to the internal audit model used by the XML generator.
 *
 * @param {object[]} rows - Parsed CSV rows
 * @param {object} shopConfig - Shop metadata entered by the user
 * @returns {{ audit: object, summary: object, errors: string[] }}
 */
export function mapShopifyToAudit(rows, shopConfig) {
  const mappingErrors = [];
  const orderGroups = groupRowsByOrder(rows);
  const orders = [];

  for (const [orderName, groupRows] of orderGroups.entries()) {
    const mapped = mapOrderGroup(orderName, groupRows, mappingErrors);
    if (mapped) {
      orders.push(mapped);
    }
  }

  const returnedOrders = mapReturnedOrders(orders);
  const reportPeriod = resolveReportPeriod(orders, shopConfig);

  const audit = {
    eik: String(shopConfig.eik || '').trim(),
    e_shop_n: truncate(shopConfig.e_shop_n || '', 10),
    domain_name: truncate(shopConfig.domain_name || '', 200),
    e_shop_type: Number(shopConfig.e_shop_type) || 1,
    creation_date: shopConfig.creation_date,
    mon: reportPeriod.mon,
    god: reportPeriod.god,
    orders: orders.map(stripInternalMeta),
    returnedOrders,
    r_ord: returnedOrders.length > 0 ? returnedOrders.length : undefined,
    r_total:
      returnedOrders.length > 0
        ? formatDecimal(returnedOrders.reduce((sum, item) => sum + parseNumber(item.r_amount), 0))
        : undefined,
  };

  return {
    audit,
    summary: {
      totalOrdersFound: orderGroups.size,
      ordersMapped: orders.length,
      returnedOrders: returnedOrders.length,
      reportMonth: reportPeriod.mon,
      reportYear: reportPeriod.god,
    },
    errors: mappingErrors,
  };
}

function stripInternalMeta(order) {
  const { _meta, ...rest } = order;
  return rest;
}

/**
 * Determine reporting month/year from config or first mapped order.
 */
function resolveReportPeriod(orders, shopConfig) {
  if (shopConfig.mon && shopConfig.god) {
    return {
      mon: String(shopConfig.mon).padStart(2, '0'),
      god: Number(shopConfig.god),
    };
  }

  if (orders.length > 0) {
    return monthYearFromDate(orders[0].ord_d);
  }

  return { mon: '01', god: new Date().getFullYear() };
}

/**
 * Build an empty audit model (header only, no orders) for periods with no sales.
 *
 * @param {object} shopConfig - Shop metadata entered by the user
 * @returns {{ audit: object, summary: object, errors: string[] }}
 */
export function createEmptyAudit(shopConfig) {
  const reportPeriod = resolveReportPeriod([], shopConfig);

  const audit = {
    eik: String(shopConfig.eik || '').trim(),
    e_shop_n: truncate(shopConfig.e_shop_n || '', 10),
    domain_name: truncate(shopConfig.domain_name || '', 200),
    e_shop_type: Number(shopConfig.e_shop_type) || 1,
    creation_date: shopConfig.creation_date,
    mon: reportPeriod.mon,
    god: reportPeriod.god,
    orders: [],
    returnedOrders: [],
  };

  return {
    audit,
    summary: {
      totalOrdersFound: 0,
      ordersMapped: 0,
      returnedOrders: 0,
      reportMonth: reportPeriod.mon,
      reportYear: reportPeriod.god,
      isEmpty: true,
    },
    errors: [],
  };
}

/**
 * Validate shop configuration before mapping or empty-file generation.
 *
 * @param {object} config
 * @param {{ requireReportPeriod?: boolean }} options
 */
export function validateShopConfig(config, options = {}) {
  const { requireReportPeriod = false } = options;
  const errors = [];

  if (!config.eik || config.eik.length < 9 || config.eik.length > 13) {
    errors.push('EIK must be between 9 and 13 characters.');
  }

  if (!config.e_shop_n) {
    errors.push('E-shop number (e_shop_n) is required.');
  }

  if (!config.domain_name) {
    errors.push('Domain name is required.');
  }

  if (![1, 2, '1', '2'].includes(config.e_shop_type)) {
    errors.push('E-shop type must be 1 (own domain) or 2 (platform).');
  }

  if (!config.creation_date) {
    errors.push('Creation date is required.');
  }

  const mon = config.mon ? String(config.mon).padStart(2, '0') : '';

  if (requireReportPeriod && !config.mon) {
    errors.push('Report month is required for an empty file.');
  }

  if (requireReportPeriod && !config.god) {
    errors.push('Report year is required for an empty file.');
  }

  if (config.mon && !/^(0[1-9]|1[0-2])$/.test(mon)) {
    errors.push('Report month must be between 01 and 12.');
  }

  if (config.god && Number(config.god) < 2020) {
    errors.push('Report year must be 2020 or later.');
  }

  return errors;
}
