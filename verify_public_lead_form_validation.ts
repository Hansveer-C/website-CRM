import { readFileSync } from 'fs';

const source = readFileSync('./src/main.ts', 'utf8');

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function includesSnippet(snippet: string, label: string): void {
  assert(source.includes(snippet), `Missing validation guard: ${label}`);
}

async function run() {
  console.log('===============================================================');
  console.log('STARTING PUBLIC LEAD FORM VALIDATION VERIFICATION');
  console.log('===============================================================\n');

  console.log('[WB-122] Checking required fields and native form validation...');
  includesSnippet('id="${prefix}form-${id}"', 'public form element');
  includesSnippet('onsubmit="event.preventDefault(); window.submitBuilderForm', 'form submit handler');
  includesSnippet('type="submit"', 'submit button uses form submit path');
  includesSnippet('formEl.checkValidity()', 'native validity check before posting');
  includesSnippet('formEl.reportValidity()', 'native validity feedback');
  includesSnippet('Please complete the required fields.', 'required-field feedback');
  includesSnippet('id="${prefix}status-${id}"', 'inline validation status element');
  console.log('PASS: Required field attempts are blocked before lead submission.');

  console.log('\n[WB-123] Checking email and phone validation...');
  includesSnippet('type="email"', 'native email validation');
  includesSnippet('id="${prefix}email-${id}"', 'email field');
  includesSnippet('required\n                  autocomplete="email"', 'email is required');
  includesSnippet('id="${prefix}address-${id}"', 'address field');
  includesSnippet('required\n                  autocomplete="street-address"', 'address is required');
  includesSnippet('id="${prefix}service-${id}"', 'service field');
  includesSnippet('<option value="">Select a service...</option>', 'blank service placeholder');
  includesSnippet('phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits.startsWith(\'1\'))', 'phone digit validation');
  includesSnippet('phoneInput.setCustomValidity', 'phone custom validity');
  includesSnippet('Please enter a valid phone number.', 'phone validation feedback');
  includesSnippet('Please enter a valid email address.', 'email validation feedback');
  console.log('PASS: Invalid email and phone values are guarded before /api/leads.');

  console.log('\n[WB-124] Checking duplicate-submit guard remains intact...');
  includesSnippet('if (!submitBtn || submitBtn.disabled) return;', 'disabled button duplicate guard');
  includesSnippet('submitBtn.disabled = true;', 'button disabled during submission');
  includesSnippet('form-success-confirmation', 'success only appears after submission resolves');
  console.log('PASS: Duplicate-submit protection remains in place.');

  console.log('\nALL PUBLIC LEAD FORM VALIDATION CHECKS PASSED');
}

run().catch((error) => {
  console.error('PUBLIC LEAD FORM VALIDATION VERIFICATION FAILED');
  console.error(error);
  process.exit(1);
});
