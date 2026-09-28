import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  renderRequestReceivedEmail,
  renderBackInStockEmail,
  renderReadyForPickupEmail,
  invoiceCustomMessage,
  toEmailItem,
  formatCad,
  escapeHtml
} from '../src/emails.js';
import worker from '../src/index.js';

// Pure template tests plus one wiring check through the real worker with a mocked fetch.
// No network, Shopify, Resend, or credential is used.
const XSS = '<script>alert("x")</script> & <b>bold</b>';
const line = (overrides = {}) => ({
  variant_id: 101, title: 'Crossfuel Whey Isolate Protein', variant_title: 'Vanilla / 680 g',
  vendor: 'Crossfuel', sku: 'CF-1', price: '54.99', quantity: 1,
  image_url: 'https://cdn.shopify.com/s/files/whey.jpg?width=160', ...overrides
});
const bare = { variant_id: 202, title: 'Plain item' };
const LONG = `Very long product title ${'with lots of words '.repeat(12)}and an ${'X'.repeat(90)} token`;

const all = (opts = {}) => [
  renderRequestReceivedEmail({ reference: '#D1', lineItems: [line()], firstName: 'Sam', ...opts.received }),
  renderBackInStockEmail({ reference: '#D1', lineItem: line(), otherLineItems: [bare], invoiceToFollow: true, firstName: 'Sam', ...opts.stock }),
  renderReadyForPickupEmail({ reference: '#D1', lineItems: [line()], message: 'See you soon', firstName: 'Sam', ...opts.ready })
];

test('every template returns subject, html and text naming the store', () => {
  for (const email of all()) {
    assert.equal(typeof email.subject, 'string');
    assert.match(email.subject, /Curly's/);
    assert.match(email.html, /^<!DOCTYPE html>/);
    assert.match(email.html, /<meta name="color-scheme" content="light dark">/);
    assert.match(email.html, /alt="Curly's Sports &amp; Supplements"/);
    assert.match(email.html, /81 South Albion Street/);
    assert.match(email.html, /tel:\+19026672875/);
    assert.match(email.text, /902-667-2875/);
    assert.match(email.text, /You're receiving this because you placed a special order at Curly's\./);
    assert.match(email.text, /#D1/);
  }
});

test('dynamic values are HTML-escaped everywhere', () => {
  const evil = line({ title: XSS, variant_title: XSS, vendor: XSS, sku: XSS });
  const emails = [
    renderRequestReceivedEmail({ reference: XSS, lineItems: [evil, { title: XSS, price: '1' }], firstName: XSS }),
    renderBackInStockEmail({ reference: XSS, lineItem: evil, otherLineItems: [evil], firstName: XSS }),
    renderReadyForPickupEmail({ reference: XSS, lineItems: [evil], message: `${XSS}\nline two`, firstName: XSS })
  ];
  for (const { html } of emails) {
    assert.ok(!html.includes('<script>'), 'no raw script tag');
    assert.ok(!html.includes('<b>bold</b>'), 'no raw injected markup');
    assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &lt;b&gt;bold&lt;/b&gt;'));
  }
  assert.match(emails[2].html, /&lt;b&gt;bold&lt;\/b&gt;<br>line two/, 'staff message keeps its line breaks');
  assert.equal(escapeHtml(`'"<>&`), '&#39;&quot;&lt;&gt;&amp;');
});

test('image URLs must be https and are attribute-escaped', () => {
  const { html } = renderRequestReceivedEmail({ reference: '#D1', lineItems: [
    line({ image_url: 'javascript:alert(1)' }),
    line({ image_url: 'https://cdn.example/a.png?x="><script>' })
  ] });
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('"><script>'));
  assert.equal(toEmailItem(line({ image_url: '//cdn.shopify.com/a.png' })).imageUrl, 'https://cdn.shopify.com/a.png');
  assert.equal(toEmailItem(line({ image_url: 'http://insecure.example/a.png' })).imageUrl, null);
});

test('plain-text part carries the content without markup', () => {
  const email = renderReadyForPickupEmail({ reference: '#D9', lineItems: [line(), bare], message: 'Hi <Sam>\nsee you' });
  assert.ok(!/<\/?(p|br|div|table|tr|td|a|strong|span|img|!--)\b/i.test(email.text), 'no template markup in text part');
  assert.ok(!/&(amp|lt|gt|quot|#39|middot|nbsp);/.test(email.text), 'no HTML entities in text part');
  assert.match(email.text, /Crossfuel Whey Isolate Protein/);
  assert.match(email.text, /Vanilla \/ 680 g · Crossfuel · SKU CF-1/);
  assert.match(email.text, /A note from the store:\nHi <Sam>\nsee you/);
  assert.match(email.text, /Plain item/);
  assert.ok(email.text.endsWith('\n'));
});

test('long titles are kept whole in the body and truncated only in the subject', () => {
  const stock = renderBackInStockEmail({ reference: '#D1', lineItem: line({ title: LONG }) });
  assert.ok(stock.subject.length < 120, `subject stays short (${stock.subject.length})`);
  assert.match(stock.subject, /^Now in stock: Very long product title .*… \| Curly's$/);
  assert.ok(stock.html.includes(escapeHtml(LONG.replace(/\s+/g, ' '))));
  assert.ok(stock.text.includes(LONG.replace(/\s+/g, ' ')));
  assert.match(stock.html, /overflow-wrap:anywhere/, 'unbroken tokens can wrap');
});

test('missing optional fields never leak placeholders', () => {
  const sparse = [{ variant_id: 5 }, { title: 'Custom tub' }, { title: '  ', quantity: 'abc', price: 'n/a' }];
  const emails = [
    renderRequestReceivedEmail({ reference: '', lineItems: sparse }),
    renderBackInStockEmail({ reference: null, lineItem: undefined }),
    renderReadyForPickupEmail({ reference: undefined, lineItems: [], message: undefined })
  ];
  for (const { subject, html, text } of emails) {
    for (const part of [subject, html, text]) {
      assert.ok(!/undefined|null|NaN|\[object Object\]/.test(part), `no placeholder in: ${part.slice(0, 80)}`);
    }
  }
  assert.match(emails[0].html, /Item #5/);
  assert.match(emails[0].html, /Special item/);
  assert.match(emails[0].html, /Hi there,/);
  assert.doesNotMatch(emails[0].html, /Order request<\/div>/, 'no reference chip without a reference');
  assert.match(emails[2].html, /No items listed/);
  assert.doesNotMatch(emails[2].html, /A note from the store/);
  assert.match(emails[2].subject, /^Ready for pickup: order request \| /);
});

test('Default Title and repeated product names are not shown as variants', () => {
  assert.equal(toEmailItem(line({ variant_title: 'Default Title' })).variant, '');
  assert.equal(toEmailItem(line({ title: 'Box', variant_title: 'Box - Default Title' })).variant, '');
  assert.equal(toEmailItem(line({ title: 'Shake', variant_title: 'Shake - Chocolate' })).variant, 'Chocolate');
});

test('prices are formatted as CAD with separators, including $0 and large values', () => {
  assert.equal(formatCad(0), '$0.00');
  assert.equal(formatCad('1249.99'), '$1,249.99');
  assert.equal(formatCad(1234567.5), '$1,234,567.50');
  assert.equal(formatCad(''), null);
  assert.equal(formatCad('abc'), null);
  const { html, text } = renderRequestReceivedEmail({ reference: '#D1', lineItems: [
    line({ price: '0' }), line({ price: '1249.99', quantity: 3 })
  ] });
  assert.match(html, /\$0\.00/);
  assert.match(html, /\$3,749\.97/);
  assert.match(html, /\$1,249\.99 each/);
  assert.match(text, /Qty 3 · \$1,249\.99 each · \$3,749\.97/);
  const noPrice = renderReadyForPickupEmail({ reference: '#D1', lineItems: [line({ price: '999' })] });
  assert.doesNotMatch(noPrice.html, /\$999/, 'ready email keeps prices hidden as before');
});

test('many items all render', () => {
  const items = Array.from({ length: 8 }, (_, i) => line({ variant_id: i + 1, title: `Product ${i + 1}` }));
  const { html, text } = renderRequestReceivedEmail({ reference: '#D1', lineItems: items });
  for (let i = 1; i <= 8; i++) {
    assert.ok(html.includes(`Product ${i}<`));
    assert.ok(text.includes(`- Product ${i}\n`));
  }
  assert.match(html, /What you asked for \(8 items\)/);
});

test('back-in-stock copy covers the invoice and what is still on the way', () => {
  const withRest = renderBackInStockEmail({ reference: '#D1', lineItem: line(), otherLineItems: [bare], invoiceToFollow: true });
  assert.match(withRest.html, /Still on the way/);
  assert.match(withRest.text, /payment link for your whole order will follow/);
  const solo = renderBackInStockEmail({ reference: '#D1', lineItem: line(), invoiceToFollow: false });
  assert.doesNotMatch(solo.html, /Still on the way|payment link/);
  assert.match(solo.text, /pay in store/);
});

test('invoice custom message is plain, short and makes no hold promise', () => {
  const msg = invoiceCustomMessage();
  assert.ok(msg.length < 255, `length ${msg.length}`);
  assert.doesNotMatch(msg, /<|>/);
  assert.doesNotMatch(msg, /\d+\s*(day|week|hour)s?/i);
  assert.match(msg, /902-667-2875/);
});

test('worker passes subject, html and text to Resend with the same recipient and reply_to', async () => {
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const ok = obj => new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.hostname === 'api.resend.com') { sent.push(JSON.parse(init.body)); return ok({ id: 'x' }); }
    if (url.pathname.endsWith('/draft_orders/77.json')) {
      return ok({ draft_order: { id: 77, name: '#D77', customer: { email: 'c@example.test', first_name: 'Cam' },
        line_items: [{ variant_id: null, title: XSS, quantity: 1, price: '5' }] } });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const env = { SHOPIFY_STORE: 'fixture.invalid', SHOPIFY_ADMIN_TOKEN: 'fixture-only', RESEND_API_KEY: 'fixture-only', FROM_EMAIL: 'from@example.test', STAFF_EMAIL: 'staff@example.test' };
    const res = await worker.fetch(new Request('https://w.invalid/api/dashboard/orders/77/email', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: '<img src=x onerror=alert(1)>' })
    }), env);
    assert.equal(res.status, 200);
    assert.equal(sent.length, 1);
    const [email] = sent;
    assert.equal(email.to, 'c@example.test');
    assert.equal(email.from, 'from@example.test');
    assert.equal(email.reply_to, 'staff@example.test');
    assert.match(email.subject, /^Ready for pickup: order #D77/);
    assert.ok(email.text && email.text.includes('<img src=x onerror=alert(1)>'), 'text part is sent (raw is fine in text)');
    assert.ok(!email.html.includes('<img src=x'), 'staff message is escaped in HTML');
    assert.ok(!email.html.includes('<script>'), 'line item title is escaped in HTML');
    assert.match(email.html, /Hi Cam,/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
