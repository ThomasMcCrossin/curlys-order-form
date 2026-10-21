#!/usr/bin/env node
// Synthetic Shopify/Resend boundary. No request ever falls through to native fetch.
import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function createFixtures(run) {
  const customers = [
    { id: 101, first_name: 'Avery', last_name: 'Verify', email: 'avery@example.invalid', phone: null },
    { id: 102, first_name: 'Nora', last_name: 'Verify', email: null, phone: '+19025550100' },
    { id: 103, first_name: 'Sam', last_name: 'Verify', email: null, phone: null }
  ];
  const variants = [
    { legacyResourceId: '201', title: 'Chocolate', displayName: 'Verify Protein - Chocolate', price: '12.50', sku: 'VERIFY-201', barcode: '9900000000201', inventoryQuantity: 0 },
    { legacyResourceId: '202', title: 'Vanilla', displayName: 'Verify Protein - Vanilla', price: '15.00', sku: 'VERIFY-202', barcode: '9900000000202', inventoryQuantity: 3 }
  ];
  const product = { id: 'gid://shopify/Product/200', title: 'Verify Protein', vendor: 'Verify Supplier', status: 'ACTIVE', featuredMedia: null };
  const drafts = [
    { id: 301, name: '#V301', customer: customers[0], tags: 'order-request,pending', created_at: new Date(Date.now() - 16 * 86400000).toISOString(), note: 'Synthetic pending request', note_attributes: [], line_items: [{ title: 'Verify Custom Bottle', price: '8.00', quantity: 1, custom: true }] },
    { id: 302, name: '#V302', customer: customers[1], tags: 'order-request,ready', created_at: new Date().toISOString(), note: 'Held for Nora\nKeep <sealed> & call on pickup', note_attributes: [], line_items: [{ title: 'Verify Protein', variant_title: 'Chocolate', variant_id: 201, price: '12.50', quantity: 2 }] }
  ];
  const messages = [];
  const persist = () => writeFileSync(join(run, 'fixture-state.json'), JSON.stringify({ customers, drafts, messages }, null, 2));
  persist();
  const ok = body => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  const audit = record => appendFileSync(join(run, 'outbound.jsonl'), JSON.stringify(record) + '\n');
  const blocked = record => { audit({ ...record, outcome: 'blocked' }); throw new Error(`Unimplemented outbound request: ${record.method} ${record.url}`); };

  const fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    const record = { method, url: url.href, body };
    // Fake key enables the real notification branch; recipient guard prevents fixture drift.
    if (url.href === 'https://api.resend.com/emails' && method === 'POST') {
      if (![body.to].flat().every(to => /^[^@\s]+@example\.invalid$/.test(to))) return blocked(record);
      messages.push(body); persist(); audit({ ...record, outcome: 'stubbed' });
      return ok({ id: `verify-message-${messages.length}` });
    }
    if (url.hostname !== 'fixture.invalid') return blocked(record);
    const path = url.pathname.replace(/^\/admin\/api\/[^/]+/, '');
    let result;
    if (path === '/customers/search.json' && method === 'GET') {
      const q = (url.searchParams.get('query') || '').replace(/^(email|phone):/, '').replaceAll('"', '').toLowerCase();
      result = { customers: customers.filter(c => Object.values(c).some(value => String(value || '').toLowerCase().includes(q))) };
    } else if (/^\/customers\/\d+\.json$/.test(path) && ['GET', 'PUT'].includes(method)) {
      const customer = customers.find(c => c.id === Number(path.match(/\d+/)[0]));
      if (!customer) return blocked(record);
      if (method === 'PUT') Object.assign(customer, body.customer);
      result = { customer };
    } else if (path === '/customers.json' && method === 'POST') {
      const customer = { ...body.customer, id: 1000 + customers.length };
      customers.push(customer); result = { customer };
    } else if (path === '/draft_orders.json' && method === 'GET') {
      result = { draft_orders: drafts };
    } else if (path === '/draft_orders.json' && method === 'POST') {
      const draft = { ...body.draft_order, id: 400 + drafts.length, name: `#V${400 + drafts.length}`, created_at: new Date().toISOString() };
      draft.customer = customers.find(c => c.id === draft.customer?.id) || null;
      draft.line_items = draft.line_items.map(li => {
        const variant = variants.find(v => Number(v.legacyResourceId) === li.variant_id);
        return variant ? { ...li, title: product.title, variant_title: variant.title, price: variant.price, sku: variant.sku } : { ...li, custom: true };
      });
      drafts.push(draft); result = { draft_order: draft };
    } else if (path === '/graphql.json' && method === 'POST') {
      const { query, variables } = body;
      if (query.includes('nodes(ids:')) {
        result = { data: { nodes: variants.filter(v => variables.ids.includes(`gid://shopify/ProductVariant/${v.legacyResourceId}`)).map(v => ({ ...v, product })) } };
      } else if (query.includes('products(first:')) {
        const filter = variables.q.toLowerCase().split(')')[0].replaceAll('(', '');
        const field = filter.includes('title:') ? product.title : filter.includes('vendor:') ? product.vendor : `${product.title} ${product.vendor}`;
        const terms = filter.replace(/(?:title|vendor):|\*|\band\b/g, '').trim().split(/\s+/);
        const matches = terms.every(term => field.toLowerCase().split(/\s+/).some(word => word.startsWith(term)));
        result = { data: { products: { edges: matches ? [{ node: { ...product, variants: { edges: variants.map(node => ({ node })) } } }] : [] } } };
      } else if (query.includes('productVariants(first:')) {
        const q = variables.q.toLowerCase();
        result = { data: { productVariants: { edges: variants.filter(v => q.includes(v.barcode) || q.includes(v.sku.toLowerCase()) || q.includes(v.title.toLowerCase())).map(v => ({ node: { ...v, product } })) } } };
      } else return blocked(record);
    } else return blocked(record);
    persist(); audit({ ...record, outcome: 'stubbed' });
    return ok(result);
  };
  return { fetch };
}
