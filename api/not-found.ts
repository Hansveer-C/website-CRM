const body = JSON.stringify({
  success: false,
  error: { code: 'NOT_FOUND', message: 'API endpoint not found.' }
});

export default {
  fetch(): Response {
    return new Response(body, {
      status: 404,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }
};
