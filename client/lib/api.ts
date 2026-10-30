export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('chef_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiRequest<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || 'Une erreur est survenue');
  }

  return body as T;
}
