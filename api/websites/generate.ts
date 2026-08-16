import { createWebsiteGenerationHandler } from '../_lib/website_generation_handler.js';

const handler = createWebsiteGenerationHandler();

export function POST(request: Request): Promise<Response> {
  return handler(request);
}

export function GET(request: Request): Promise<Response> {
  return handler(request);
}

export function PUT(request: Request): Promise<Response> {
  return handler(request);
}

export function PATCH(request: Request): Promise<Response> {
  return handler(request);
}

export function DELETE(request: Request): Promise<Response> {
  return handler(request);
}

export function OPTIONS(request: Request): Promise<Response> {
  return handler(request);
}
