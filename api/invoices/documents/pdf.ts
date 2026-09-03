import { createInvoiceDocumentPdfHandler } from '../../_lib/invoice_document_pdf_handler.js';
const handler = createInvoiceDocumentPdfHandler();
export function POST(request: Request): Promise<Response> { return handler(request); }
export function GET(request: Request): Promise<Response> { return handler(request); }
export function PUT(request: Request): Promise<Response> { return handler(request); }
export function PATCH(request: Request): Promise<Response> { return handler(request); }
export function DELETE(request: Request): Promise<Response> { return handler(request); }
