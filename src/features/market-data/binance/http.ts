import type { HttpClient } from '../types';

export async function fetchJson<T>(httpClient: HttpClient, url: URL): Promise<T> {
  const response = await httpClient(url.toString());

  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${url.pathname}`);
  }

  return response.json() as Promise<T>;
}

export function appendDefinedParams(url: URL, params: Record<string, string | number | undefined>): URL {
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}
