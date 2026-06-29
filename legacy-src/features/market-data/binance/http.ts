import type { HttpClient } from '../types';

const defaultRequestTimeoutMs = 8_000;

export async function withFetchTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  label: string,
  timeoutMs = defaultRequestTimeoutMs,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await task(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${label} timed out after ${timeoutMs}ms.`, { cause: error });
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export async function fetchJson<T>(httpClient: HttpClient, url: URL, timeoutMs = defaultRequestTimeoutMs): Promise<T> {
  return withFetchTimeout(
    async (timeoutSignal) => {
      const response = await httpClient(url.toString(), {
        signal: timeoutSignal,
      });

      if (!response.ok) {
        throw new Error(`Request failed ${response.status}: ${url.pathname}`);
      }

      return response.json() as Promise<T>;
    },
    `Request ${url.pathname}`,
    timeoutMs,
  );
}

export function appendDefinedParams(url: URL, params: Record<string, string | number | undefined>): URL {
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}
