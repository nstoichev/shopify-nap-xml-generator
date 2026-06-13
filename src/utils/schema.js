/**
 * Schema definition derived from dec_audit.xsd.
 * Used by the validator to check structure, required fields, and data types.
 */
export const AUDIT_SCHEMA = {
  root: 'audit',
  elements: {
    audit: {
      type: 'complex',
      // r_ord is optional in the XSD, but NAP rejects files without it.
      children: ['eik', 'e_shop_n', 'domain_name', 'e_shop_type', 'creation_date', 'mon', 'god', 'order', 'r_ord'],
      optionalChildren: ['rorder', 'r_total'],
    },
    eik: {
      type: 'string',
      required: true,
      minLength: 9,
      maxLength: 13,
      label: 'ЕИК',
    },
    e_shop_n: {
      type: 'string',
      required: true,
      maxLength: 10,
      label: 'Номер на е-магазин',
    },
    domain_name: {
      type: 'string',
      required: true,
      maxLength: 200,
      label: 'Домейн',
    },
    e_shop_type: {
      type: 'integer',
      required: true,
      enum: [1, 2],
      label: 'Тип е-магазин',
    },
    creation_date: {
      type: 'date',
      required: true,
      label: 'Дата на създаване',
    },
    mon: {
      type: 'month',
      required: true,
      enum: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
      label: 'Месец',
    },
    god: {
      type: 'year',
      required: true,
      min: 2020,
      label: 'Година',
    },
    order: {
      type: 'complex',
      required: true,
      children: ['orderenum'],
      // dec_audit.xsd requires at least one orderenum inside order.
      minChildren: { orderenum: 1 },
    },
    orderenum: {
      type: 'complex',
      children: [
        'ord_n',
        'ord_d',
        'doc_n',
        'doc_date',
        'art',
        'ord_total1',
        'ord_disc',
        'ord_vat',
        'ord_total2',
        'paym',
      ],
      optionalChildren: ['pos_n', 'trans_n', 'proc_id'],
    },
    ord_n: { type: 'string', required: true, maxLength: 300, label: 'Номер на поръчка' },
    ord_d: { type: 'date', required: true, label: 'Дата на поръчка' },
    doc_n: { type: 'integer', required: true, digitLength: 10, label: 'Номер на документ' },
    doc_date: { type: 'date', required: true, label: 'Дата на документ' },
    art: {
      type: 'complex',
      required: true,
      children: ['artenum'],
      minChildren: { artenum: 1 },
    },
    artenum: {
      type: 'complex',
      children: ['art_name', 'art_quant', 'art_price', 'art_vat_rate', 'art_vat', 'art_sum'],
    },
    art_name: { type: 'string', required: true, maxLength: 200, label: 'Наименование' },
    art_quant: { type: 'decimal', required: true, fractionDigits: 2, label: 'Количество' },
    art_price: { type: 'decimal', required: true, fractionDigits: 2, label: 'Единична цена без ДДС' },
    art_vat_rate: { type: 'integer', required: true, min: 0, max: 100, label: 'ДДС ставка' },
    art_vat: { type: 'decimal', required: true, fractionDigits: 2, label: 'ДДС сума' },
    art_sum: { type: 'decimal', required: true, fractionDigits: 2, label: 'Обща сума с ДДС' },
    ord_total1: { type: 'decimal', required: true, fractionDigits: 2, label: 'Обща стойност без ДДС' },
    ord_disc: { type: 'decimal', required: true, fractionDigits: 2, label: 'Отстъпка' },
    ord_vat: { type: 'decimal', required: true, fractionDigits: 2, label: 'ДДС на поръчка' },
    ord_total2: { type: 'decimal', required: true, fractionDigits: 2, label: 'Обща стойност с ДДС' },
    paym: { type: 'integer', required: true, enum: [1, 2, 3, 4, 5, 6], label: 'Начин на плащане' },
    pos_n: { type: 'string', optional: true, maxLength: 200, label: 'Виртуален ПОС' },
    trans_n: { type: 'string', optional: true, maxLength: 200, label: 'Транзакция' },
    proc_id: { type: 'string', optional: true, maxLength: 200, label: 'Платежен доставчик' },
    r_ord: { type: 'integer', required: true, label: 'Брой върнати поръчки' },
    rorder: {
      type: 'complex',
      optional: true,
      children: ['rorderenum'],
    },
    rorderenum: {
      type: 'complex',
      children: ['r_ord_n', 'r_amount', 'r_date', 'r_paym'],
    },
    r_ord_n: { type: 'string', required: true, maxLength: 300, label: 'Номер на върната поръчка' },
    r_amount: { type: 'decimal', required: true, fractionDigits: 2, label: 'Върната сума' },
    r_date: { type: 'date', required: true, label: 'Дата на връщане' },
    r_paym: { type: 'integer', required: true, enum: [1, 2, 3, 4], label: 'Начин на връщане' },
    r_total: { type: 'decimal', optional: true, fractionDigits: 2, label: 'Обща върната сума' },
  },
};

/**
 * Shopify column name candidates for flexible CSV matching.
 */
export const SHOPIFY_COLUMNS = {
  orderName: ['Name', 'Order Name', 'Order number'],
  createdAt: ['Created at', 'Created At', 'Processed at'],
  financialStatus: ['Financial Status', 'Payment Status'],
  paymentMethod: ['Payment Method', 'Payment method', 'Gateway'],
  subtotal: ['Subtotal'],
  taxes: ['Taxes', 'Total Tax', 'Tax 1 Value'],
  total: ['Total'],
  discountAmount: ['Discount Amount', 'Total Discounts'],
  lineItemName: ['Lineitem name', 'Line Item Name', 'Lineitem title'],
  lineItemQuantity: ['Lineitem quantity', 'Line Item Quantity'],
  lineItemPrice: ['Lineitem price', 'Line Item Price'],
  lineItemSku: ['Lineitem sku', 'Line Item SKU'],
  refundedAmount: ['Refunded Amount'],
  cancelledAt: ['Cancelled at', 'Cancelled At'],
};
