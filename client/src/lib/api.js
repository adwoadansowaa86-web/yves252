const TOKEN_KEY = 'shop-admin-token';

export const adminToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function api(path, { method = 'GET', body, raw = false, headers = {} } = {}) {
  const token = adminToken.get();
  const isForm = body instanceof FormData;
  const isText = typeof body === 'string';
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body && !isForm && !isText ? { 'Content-Type': 'application/json' } : {}),
      ...(token && path.startsWith('/admin') ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isForm || isText ? body : JSON.stringify(body),
  });
  if (raw && res.ok) return res;
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && path.startsWith('/admin') && path !== '/admin/login') {
      adminToken.clear();
      window.dispatchEvent(new Event('admin-logout'));
    }
    throw new ApiError(data?.error ?? 'Something went wrong', res.status, data);
  }
  return data;
}

/** Downloads a file from an admin endpoint (needs the auth header). */
export async function download(path, filename) {
  const res = await api(path, { raw: true });
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
