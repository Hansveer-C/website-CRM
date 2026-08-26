import { createLocalSeoInventoryHandler } from '../_lib/local_seo_batch_handler.js';

const handler = createLocalSeoInventoryHandler();
export function GET(request: Request): Promise<Response> { return handler(request); }
export function POST(request: Request): Promise<Response> { return handler(request); }
export function PUT(request: Request): Promise<Response> { return handler(request); }
export function DELETE(request: Request): Promise<Response> { return handler(request); }
