import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

// Exercise the actual inline form functions with a disposable DOM fixture.
// No browser, Shopify session, credential, or external action is needed.
const html = readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
const start = html.indexOf('    function selectCustomer(customer) {');
const end = html.indexOf('    function toggleManualEntry()', start);
assert.ok(start >= 0 && end > start, 'form functions are present');

function fixture() {
  const ids = [
    'selectedCustomerCard', 'selectedCustomerName', 'selectedCustomerEmail',
    'selectedCustomerPhone', 'phoneNumberSection', 'customerPhoneInput',
    'phoneVerifyNote', 'phoneRefusedCheckbox', 'missingPhonePrompt',
    'phoneErrorNote', 'customerSearchSection', 'customerSearch', 'customerResults'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, {
    style: {}, value: '', checked: false, disabled: false, textContent: '',
    focus() { this.focused = true; }, classList: { remove() {} }
  }]));
  const context = { document: { getElementById: id => {
    assert.ok(elements[id], `fixture missing ${id}`); return elements[id];
  } }, formatPhoneDisplay: value => value };
  vm.runInNewContext(`${html.slice(start, end)}\nthis.api = { selectCustomer, showPhoneNumberSection, clearCustomer };`, context);
  return { e: elements, ...context.api };
}

test('missing phone offers an inline prompt and focuses input on activation', () => {
  const { e, selectCustomer, showPhoneNumberSection } = fixture();
  selectCustomer({ firstName: 'Test', lastName: 'Person', email: '', phone: '' });
  assert.equal(e.missingPhonePrompt.style.display, 'block');
  assert.equal(e.phoneNumberSection.style.display, 'none');
  showPhoneNumberSection();
  assert.equal(e.missingPhonePrompt.style.display, 'none');
  assert.equal(e.phoneNumberSection.style.display, 'block');
  assert.equal(e.customerPhoneInput.focused, true);
});

test('existing phone retains verification display without edit prompt', () => {
  const { e, selectCustomer, clearCustomer } = fixture();
  selectCustomer({ firstName: 'Test', lastName: 'Person', email: '', phone: 'fixture-phone' });
  assert.equal(e.missingPhonePrompt.style.display, 'none');
  assert.equal(e.phoneNumberSection.style.display, 'none');
  assert.equal(e.phoneVerifyNote.style.display, 'block');
  assert.equal(e.customerPhoneInput.value, 'fixture-phone');
  clearCustomer();
  assert.equal(e.missingPhonePrompt.style.display, 'none');
  assert.equal(e.customerPhoneInput.value, '');
});
