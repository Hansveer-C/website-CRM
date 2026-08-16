const body = JSON.stringify({
  success: false,
  error: { code: 'NOT_FOUND', message: 'API endpoint not found.' }
});

function notFound(): Response {
  return new Response(body, {
    status: 404,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const OPTIONS = notFound;
