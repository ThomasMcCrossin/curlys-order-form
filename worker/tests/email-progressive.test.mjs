import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

// Exercise the actual inline form functions with a disposable DOM fixture.
// No browser, Shopify session, credential, or external action is needed.
const html = readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
function slice(from, to) {
  const start = html.indexOf(from);
  const end = html.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `source slice ${from.trim()} is present`);
  return html.slice(start, end);
}
const source = [
  slice('    function selectCustomer(customer) {', '    function toggleManualEntry()'),
  slice('    function getCustomerData() {', '    // Messages'),
  slice('    function validatePhone(phone) {', '    function toggleEmailRequired()')
].join('\n');

function fixture() {
  const ids = [
    'selectedCustomerCard', 'selectedCustomerName', 'selectedCustomerEmail',
    'selectedCustomerPhone', 'emailSection', 'customerEmailInput', 'emailErrorNote',
    'emailRefusedCheckbox', 'missingEmailPrompt', 'customerPhoneGroup',
    'customerPhoneInput', 'phoneErrorNote', 'customerSearchSection', 'customerSearch',
    'customerResults', 'firstName', 'lastName', 'email', 'manualEmailErrorNote',
    'manualEmailRefusedCheckbox', 'phone', 'manualPhoneErrorNote'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, {
    style: {}, value: '', checked: false, disabled: false, textContent: '',
    focus() { this.focused = true; }, classList: { remove() {} }
  }]));
  const context = { document: { getElementById: id => {
    assert.ok(elements[id], `fixture missing ${id}`); return elements[id];
  } }, selectedCustomer: null };
  vm.runInNewContext(`${source}
this.api = {
  selectCustomer, showEmailSection, clearCustomer, validateContactFields, getCustomerData,
  setSelected(c) { selectedCustomer = c; }
};`, context);
  return { e: elements, ...context.api };
}

const person = { id: 'gid://shopify/Customer/1', firstName: 'Test', lastName: 'Person' };

test('missing email offers an inline prompt and focuses input on activation', () => {
  const { e, selectCustomer, showEmailSection } = fixture();
  selectCustomer({ ...person, email: '', phone: '9025550100' });
  assert.equal(e.missingEmailPrompt.style.display, 'block');
  assert.equal(e.emailSection.style.display, 'none');
  assert.equal(e.customerPhoneGroup.style.display, 'none', 'phone on file: no phone field');
  showEmailSection();
  assert.equal(e.missingEmailPrompt.style.display, 'none');
  assert.equal(e.emailSection.style.display, 'block');
  assert.equal(e.customerEmailInput.focused, true);
});

test('customer missing only a phone gets no prompt and is not blocked', () => {
  const { e, selectCustomer, clearCustomer, validateContactFields, getCustomerData } = fixture();
  selectCustomer({ ...person, email: 'a@example.com', phone: '' });
  assert.equal(e.missingEmailPrompt.style.display, 'none');
  assert.equal(e.emailSection.style.display, 'none');
  assert.equal(validateContactFields(), true);
  assert.equal(e.emailSection.style.display, 'none');
  assert.deepEqual({ ...getCustomerData() }, { ...person, email: 'a@example.com', phone: '' });
  clearCustomer();
  assert.equal(e.missingEmailPrompt.style.display, 'none');
  assert.equal(e.customerEmailInput.value, '');
});

test('selected customer without email: gate reveals section, then accepts entered email', () => {
  const { e, selectCustomer, validateContactFields, getCustomerData } = fixture();
  selectCustomer({ ...person, email: '', phone: '9025550100' });
  assert.equal(validateContactFields(), false);
  assert.equal(e.emailSection.style.display, 'block');
  assert.equal(e.emailErrorNote.style.display, 'block');
  e.customerEmailInput.value = ' new@example.com ';
  assert.equal(validateContactFields(), true);
  assert.deepEqual({ ...getCustomerData() }, { ...person, email: 'new@example.com', phone: '9025550100' });
});

test('selected customer without email or phone: refusal requires a phone', () => {
  const { e, selectCustomer, validateContactFields, getCustomerData } = fixture();
  selectCustomer({ ...person, email: '', phone: '' });
  assert.equal(e.customerPhoneGroup.style.display, 'block');
  e.emailRefusedCheckbox.checked = true;
  assert.equal(validateContactFields(), false);
  assert.equal(e.phoneErrorNote.style.display, 'block');
  e.customerPhoneInput.value = '(902) 555-0101';
  assert.equal(validateContactFields(), true);
  assert.deepEqual({ ...getCustomerData() }, { ...person, email: '', phone: '9025550101' });
});

test('selected customer with phone on file may refuse email without new phone', () => {
  const { e, selectCustomer, validateContactFields, getCustomerData } = fixture();
  selectCustomer({ ...person, email: '', phone: '+19025550100' });
  e.emailRefusedCheckbox.checked = true;
  assert.equal(validateContactFields(), true);
  assert.equal(getCustomerData().phone, '+19025550100');
});

test('manual entry: email required unless refused; refusal requires phone; phone format kept', () => {
  const { e, validateContactFields, getCustomerData } = fixture();
  assert.equal(validateContactFields(), false, 'no email, not refused');
  assert.equal(e.manualEmailErrorNote.style.display, 'block');

  e.email.value = 'not-an-email';
  assert.equal(validateContactFields(), false, 'malformed email');

  e.email.value = 'm@example.com';
  assert.equal(validateContactFields(), true, 'email alone is enough');
  assert.equal(getCustomerData().phone, '');

  e.phone.value = '12345';
  assert.equal(validateContactFields(), false, 'entered phone must still be valid');
  assert.equal(e.manualPhoneErrorNote.style.display, 'block');

  e.email.value = '';
  e.phone.value = '';
  e.manualEmailRefusedCheckbox.checked = true;
  assert.equal(validateContactFields(), false, 'refused email and no phone');
  e.phone.value = '1-902-555-0102';
  assert.equal(validateContactFields(), true);
  const data = getCustomerData();
  assert.equal(data.email, '');
  assert.equal(data.phone, '9025550102');
});
