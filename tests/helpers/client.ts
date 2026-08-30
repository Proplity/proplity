import { TEST_BASE_URL } from '../setup/constants';

type ApiFetchOptions = {
  method?: string;
  body?: unknown;
  /** Send this exact string as the body instead of JSON.stringify(body) -- for
   * callers (e.g. the payments webhook) that need to sign or otherwise depend
   * on the precise raw bytes sent. Takes precedence over `body` if both are set. */
  rawBody?: string;
  cookie?: string;
  headers?: Record<string, string>;
};

export type ApiResponse<T = any> = {
  status: number;
  body: T;
  setCookies: string[];
  headers: Headers;
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
  const { method = 'GET', body, rawBody, cookie, headers = {} } = opts;

  // FormData (multipart file uploads) must be sent as-is, with no
  // Content-Type set -- fetch computes the multipart boundary itself only
  // when the header is absent, the same constraint apiClient.ts's browser
  // code works around.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const res = await fetch(`${TEST_BASE_URL}${pathAndQuery}`, {
    method,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      Origin: TEST_BASE_URL,
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body:
      rawBody !== undefined
        ? rawBody
        : isFormData
          ? (body as FormData)
          : body !== undefined
            ? JSON.stringify(body)
            : undefined,
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

  return { status: res.status, body: responseBody, setCookies, headers: res.headers };
}

/** Extracts `name=value` pairs from Set-Cookie headers, joined for reuse as a request Cookie header. */
export function cookieHeaderFrom(setCookies: string[]): string {
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}
