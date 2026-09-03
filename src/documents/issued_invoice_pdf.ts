import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export type FrozenInvoiceDocumentSpec = { issuer: Record<string, unknown>; invoice: Record<string, unknown>; items: Array<Record<string, unknown>> };
export const PDF_MIME_TYPE = 'application/pdf';
export const PDF_TEMPLATE_KEY = 'washops-issued-invoice';
export const PDF_TEMPLATE_VERSION = 1;
const fontBytes = readFileSync(new URL('./assets/NotoSans-Regular.ttf', import.meta.url));
const sourceFont = fontkit.create(fontBytes);
const MAX_TEXT = 500;

function text(value: unknown): string {
  const result = typeof value === 'string' || typeof value === 'number' ? String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  if (result.length > MAX_TEXT) throw new Error('PDF_TEXT_TOO_LONG');
  for (const character of result) if (!sourceFont.hasGlyphForCodePoint(character.codePointAt(0)!)) throw new Error('PDF_UNSUPPORTED_GLYPH');
  return result;
}
function money(value: unknown, currency: unknown): string { return `${text(currency) || 'USD'} ${text(value)}`; }
function lines(value: unknown): string[] { return text(value).split(/\r?\n/).filter(Boolean); }

export async function renderIssuedInvoicePdf(specification: FrozenInvoiceDocumentSpec): Promise<Uint8Array> {
  if (!specification || !Array.isArray(specification.items) || !specification.issuer || !specification.invoice) throw new Error('INVALID_DOCUMENT_SPEC');
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  pdf.setTitle(`Invoice ${text(specification.invoice.invoice_number)}`); pdf.setProducer('WashOps CRM DOC-1B2'); pdf.setCreationDate(new Date(0)); pdf.setModificationDate(new Date(0));
  const font = await pdf.embedFont(fontBytes, { subset: true }); const page = pdf.addPage([612, 792]);
  let y = 750; const draw = (value: unknown, x: number, size = 10, color = rgb(0.1, 0.12, 0.16)) => { const valueText = text(value); font.encodeText(valueText); page.drawText(valueText, { x, y, size, font, color, maxWidth: 540 - x }); y -= size + 5; };
  const issuer = specification.issuer; const invoice = specification.invoice;
  draw(text(issuer.business_name) || 'Invoice', 40, 20); draw(issuer.email, 40); draw(issuer.phone, 40); y -= 12;
  const rightY = y + 42; page.drawText('INVOICE', { x: 420, y: rightY, size: 16, font, color: rgb(0.1, 0.12, 0.16) });
  page.drawText(`Number: ${text(invoice.invoice_number)}`, { x: 380, y: rightY - 22, size: 9, font }); page.drawText(`Issue: ${text(invoice.issued_at)}`, { x: 380, y: rightY - 36, size: 9, font }); page.drawText(`Due: ${text(invoice.due_at)}`, { x: 380, y: rightY - 50, size: 9, font });
  draw('Bill to', 40, 11); draw(invoice.customer_name, 40); draw(invoice.customer_email, 40); draw(invoice.customer_phone, 40); for (const addressLine of lines(invoice.billing_address)) draw(addressLine, 40); y -= 15;
  page.drawRectangle({ x: 40, y: y - 16, width: 532, height: 18, color: rgb(0.92, 0.94, 0.96) }); page.drawText('Description', { x: 45, y: y - 4, size: 9, font }); page.drawText('Qty', { x: 390, y: y - 4, size: 9, font }); page.drawText('Rate', { x: 440, y: y - 4, size: 9, font }); page.drawText('Total', { x: 510, y: y - 4, size: 9, font }); y -= 28;
  for (const item of specification.items) { if (y < 90) throw new Error('PDF_TOO_MANY_LINE_ITEMS'); const description = text(item.service_name) + (text(item.description) ? ` — ${text(item.description)}` : ''); draw(description, 45, 9); const rowY = y + 14; page.drawText(text(item.quantity), { x: 390, y: rowY, size: 9, font }); page.drawText(money(item.unit_price, invoice.currency), { x: 440, y: rowY, size: 8, font, maxWidth: 62 }); page.drawText(money(item.line_total, invoice.currency), { x: 510, y: rowY, size: 8, font, maxWidth: 60 }); }
  y -= 10; page.drawLine({ start: { x: 380, y }, end: { x: 572, y }, thickness: 1, color: rgb(0.6, 0.65, 0.7) }); y -= 20; page.drawText(`Total: ${money(invoice.total_amount, invoice.currency)}`, { x: 430, y, size: 12, font });
  return pdf.save({ useObjectStreams: false });
}

export function sha256(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex'); }
