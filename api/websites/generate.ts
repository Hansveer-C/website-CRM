import { createWebsiteGenerationHandler } from '../_lib/website_generation_handler';

const handler = createWebsiteGenerationHandler();

export default function generateWebsite(request: Request): Promise<Response> {
  return handler(request);
}
