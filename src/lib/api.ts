export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  // Authentication is carried only by the server's HttpOnly session cookie.
  headers.delete('Authorization');
  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
}
