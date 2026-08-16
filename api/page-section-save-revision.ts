import { createPageSectionSaveHandler } from './_lib/page_section_save_handler.js';

const handler = createPageSectionSaveHandler();

export function GET(request: Request): Promise<Response> { return handler(request); }
export function PUT(request: Request): Promise<Response> { return handler(request); }
export function POST(request: Request): Promise<Response> { return handler(request); }
export function PATCH(request: Request): Promise<Response> { return handler(request); }
export function DELETE(request: Request): Promise<Response> { return handler(request); }
export function OPTIONS(request: Request): Promise<Response> { return handler(request); }
