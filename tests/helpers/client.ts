import { TEST_BASE_URL } from '../setup/constants';

type ApiFetchOptions = {
  method?: string;
  body?: unknown;
  cookie?: string;
  headers?: Record<string, string>;
};

export type ApiResponse<T = any> = {
  status: number;
  body: T;
  setCookies: string[];
};

/**
 * Hits the real spawned test server over HTTP -- exactly what every prior
 * phase's manual `curl` verification did, just made repeatable. Sets Origin
 * so mutating routes pass validateCSRF() (Node's fetch doesn't send Origin
 * the way a browser does).
 */
export async function apiFetch<T = any>(
  pathAndQuery: string,
  opts: ApiFetchOptions = {},
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, cookie, headers = {} } = opts;

  const res = await fetch(`${TEST_BASE_URL}${pathAndQuery}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: TEST_BASE_URL,
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });

  const setCookies =
    typeof (res.headers as any).getSetCookie === 'function'
      ? (res.headers as any).getSetCookie()
      : ([res.headers.get('set-cookie')].filter(Boolean) as string[]);

  let responseBody: T;
  const text = await res.text();
  try {
    responseBody = text ? JSON.parse(text) : (undefined as unknown as T);
  } catch {
    responseBody = text as unknown as T;
  }

  return { status: res.status, body: responseBody, setCookies };
}

/** Extracts `name=value` pairs from Set-Cookie headers, joined for reuse as a request Cookie header. */
export function cookieHeaderFrom(setCookies: string[]): string {
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}
