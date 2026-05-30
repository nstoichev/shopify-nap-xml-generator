import { create } from 'xmlbuilder2';

/**
 * Build a single artenum node from an internal article model.
 */
function buildArticleNode(parentArt, article) {
  const artenum = parentArt.ele('artenum');
  artenum.ele('art_name').txt(article.art_name);
  artenum.ele('art_quant').txt(String(article.art_quant));
  artenum.ele('art_price').txt(String(article.art_price));
  artenum.ele('art_vat_rate').txt(String(article.art_vat_rate));
  artenum.ele('art_vat').txt(String(article.art_vat));
  artenum.ele('art_sum').txt(String(article.art_sum));
}

/**
 * Build a single orderenum node from an internal order model.
 */
function buildOrderNode(parentOrder, order) {
  const orderenum = parentOrder.ele('orderenum');

  orderenum.ele('ord_n').txt(order.ord_n);
  orderenum.ele('ord_d').txt(order.ord_d);
  orderenum.ele('doc_n').txt(String(order.doc_n));
  orderenum.ele('doc_date').txt(order.doc_date);

  const art = orderenum.ele('art');
  for (const article of order.articles) {
    buildArticleNode(art, article);
  }

  orderenum.ele('ord_total1').txt(String(order.ord_total1));
  orderenum.ele('ord_disc').txt(String(order.ord_disc));
  orderenum.ele('ord_vat').txt(String(order.ord_vat));
  orderenum.ele('ord_total2').txt(String(order.ord_total2));
  orderenum.ele('paym').txt(String(order.paym));

  // Optional payment-related fields – included as empty tags when not set,
  // matching the reference vik_simple.xml example.
  orderenum.ele('pos_n').txt(order.pos_n || '');
  orderenum.ele('trans_n').txt(order.trans_n || '');
  orderenum.ele('proc_id').txt(order.proc_id || '');
}

/**
 * Build returned order nodes when present.
 */
function buildReturnedOrders(auditRoot, auditModel) {
  if (!auditModel.returnedOrders?.length) {
    return;
  }

  auditRoot.ele('r_ord').txt(String(auditModel.r_ord ?? auditModel.returnedOrders.length));

  const rorder = auditRoot.ele('rorder');
  for (const returned of auditModel.returnedOrders) {
    const rorderenum = rorder.ele('rorderenum');
    rorderenum.ele('r_ord_n').txt(returned.r_ord_n);
    rorderenum.ele('r_amount').txt(String(returned.r_amount));
    rorderenum.ele('r_date').txt(returned.r_date);
    rorderenum.ele('r_paym').txt(String(returned.r_paym));
  }

  if (auditModel.r_total !== undefined) {
    auditRoot.ele('r_total').txt(String(auditModel.r_total));
  }
}

/**
 * Generate NAP audit XML from the internal audit model.
 *
 * Structure follows dec_audit.xsd and vik_simple.xml:
 *   audit
 *     eik, e_shop_n, domain_name, e_shop_type, creation_date, mon, god
 *     order > orderenum > (ord_*, art > artenum > art_*, totals, paym, ...)
 *     [r_ord, rorder > rorderenum, r_total]
 *
 * @param {object} auditModel - Normalized audit object from shopifyMapper
 * @returns {string} Pretty-printed UTF-8 XML
 */
export function generateAuditXml(auditModel) {
  if (!auditModel) {
    throw new Error('No audit data available for XML generation.');
  }

  if (!auditModel.orders?.length) {
    throw new Error('No orders to include in the XML file.');
  }

  const auditRoot = create({ version: '1.0', encoding: 'UTF-8' }).ele('audit');

  auditRoot.ele('eik').txt(auditModel.eik);
  auditRoot.ele('e_shop_n').txt(auditModel.e_shop_n);
  auditRoot.ele('domain_name').txt(auditModel.domain_name);
  auditRoot.ele('e_shop_type').txt(String(auditModel.e_shop_type));
  auditRoot.ele('creation_date').txt(auditModel.creation_date);
  auditRoot.ele('mon').txt(auditModel.mon);
  auditRoot.ele('god').txt(String(auditModel.god));

  const orderContainer = auditRoot.ele('order');

  for (const order of auditModel.orders) {
    buildOrderNode(orderContainer, order);
  }

  buildReturnedOrders(auditRoot, auditModel);

  return auditRoot.doc().end({ prettyPrint: true, indent: '\t' });
}

/**
 * Suggested download filename based on report period.
 */
export function buildXmlFilename(auditModel) {
  const mon = auditModel?.mon || '00';
  const god = auditModel?.god || '0000';
  return `orders_${god}_${mon}.xml`;
}
