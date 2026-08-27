import { renderButton, renderCard, renderField, renderInput, renderSelect, renderTextarea } from '../primitives';

const serviceOptions = [
  'Residential Pressure Washing',
  'Commercial Exterior Cleaning',
  'Roof & Gutter Cleaning',
  'Driveway & Walkway Restore',
  'Deck & Patio Wash'
];

export function renderLeadCaptureContent(): string {
  const serviceOptionHtml = serviceOptions.map(value => `<option value="${value}">${value}</option>`).join('');
  const form = `<form id="lead-form" class="wo-lead-capture-form"><div class="wo-lead-capture-grid">${renderField({ id: 'lead_name', label: 'Full name', required: true, controlHtml: renderInput({ id: 'lead_name', type: 'text', placeholder: 'John Doe', required: true, attributes: { autocomplete: 'name' } }) })}${renderField({ id: 'lead_phone', label: 'Phone number', required: true, controlHtml: renderInput({ id: 'lead_phone', type: 'tel', placeholder: '555-012-3456', required: true, attributes: { autocomplete: 'tel' } }) })}${renderField({ id: 'lead_email', label: 'Email address', required: true, controlHtml: renderInput({ id: 'lead_email', type: 'email', placeholder: 'john@example.com', required: true, attributes: { autocomplete: 'email' } }) })}${renderField({ id: 'lead_address', label: 'Service address', required: true, controlHtml: renderInput({ id: 'lead_address', type: 'text', placeholder: '123 Main St, Anytown', required: true, attributes: { autocomplete: 'street-address' } }) })}${renderField({ id: 'lead_service_type', label: 'Service type', required: true, className: 'wo-lead-capture-field--full', controlHtml: renderSelect({ id: 'lead_service_type', required: true, options: [{ value: '', label: 'Select a service…', disabled: true }, ...serviceOptions.map(value => ({ value, label: value }))] }) })}${renderField({ id: 'lead_message', label: 'Message / details', required: true, className: 'wo-lead-capture-field--full', controlHtml: renderTextarea({ id: 'lead_message', rows: 5, placeholder: 'Description of what needs cleaning…', required: true }) })}</div><div class="wo-lead-capture-actions">${renderButton({ id: 'lead-submit', label: 'Submit lead info', variant: 'primary', type: 'submit' })}<p id="lead-submit-status" class="wo-sr-only" aria-live="polite"></p></div></form>`;
  return `<section class="wo-lead-capture" aria-label="Lead details">${renderCard({ className: 'wo-lead-capture-card', bodyHtml: `<div class="wo-lead-capture-intro"><h2>Lead details</h2><p>Enter the details needed to create a lead and sales opportunity.</p></div>${form}` })}</section>`;
}
