import { ApiError, RateLimitError } from '@/types/api';
import type { FieldError } from '@/types/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/register'];

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

interface ParsedError {
  message: string;
  errors: FieldError[];
  details: Record<string, unknown>;
}

function isFastApiValidationItem(value: unknown): value is { loc: unknown[]; msg: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'loc' in value &&
    'msg' in value &&
    Array.isArray((value as { loc: unknown }).loc) &&
    typeof (value as { msg: unknown }).msg === 'string'
  );
}

async function parseErrorResponse(response: Response): Promise<ParsedError> {
  const fallback = response.statusText || 'An unexpected error occurred';
  const empty: ParsedError = { message: fallback, errors: [], details: {} };

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return empty;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return empty;
  }

  if (!body || typeof body !== 'object') {
    return empty;
  }

  const obj = body as Record<string, unknown>;

  // Backwards-compatible shape: { message, errors? }
  if (typeof obj.message === 'string') {
    return {
      message: obj.message,
      errors: Array.isArray(obj.errors) ? (obj.errors as FieldError[]) : [],
      details: {},
    };
  }

  // FastAPI shapes: { detail: ... }
  const detail = obj.detail;

  // HTTPException(detail="msg") → { detail: "msg" }
  if (typeof detail === 'string') {
    return { message: detail, errors: [], details: {} };
  }

  // Pydantic validation → { detail: [{ loc, msg, type }, ...] }
  if (Array.isArray(detail)) {
    const errors: FieldError[] = detail.filter(isFastApiValidationItem).map((item) => ({
      field: String(item.loc[item.loc.length - 1] ?? ''),
      message: item.msg,
    }));
    return {
      message: errors[0]?.message ?? 'Validation failed',
      errors,
      details: {},
    };
  }

  // HTTPException(detail={...}) → { detail: { detail?, message?, ...rest } }
  if (detail && typeof detail === 'object') {
    const detailObj = detail as Record<string, unknown>;
    const innerDetail = detailObj.detail;
    const innerMessage = detailObj.message;

    let message = fallback;
    if (typeof innerDetail === 'string') message = innerDetail;
    else if (typeof innerMessage === 'string') message = innerMessage;

    const { detail: _d, message: _m, ...rest } = detailObj;
    void _d;
    void _m;
    return { message, errors: [], details: rest };
  }

  return empty;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {}, signal } = options;

  const config: RequestInit = {
    method,
    credentials: 'include',
    headers: { ...headers },
    signal,
  };

  if (body !== undefined) {
    config.headers = {
      'Content-Type': 'application/json',
      ...headers,
    };
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  if (response.status === 429) {
    const errorData = await parseErrorResponse(response);
    throw new RateLimitError(errorData.message);
  }

  if (response.status === 401) {
    const isAuthEndpoint = AUTH_ENDPOINTS.some(
      (path) => endpoint === path || endpoint.startsWith(path + '?'),
    );

    if (!isAuthEndpoint) {
      window.dispatchEvent(new Event('auth:expired'));
    }

    const errorData = await parseErrorResponse(response);
    throw new ApiError(errorData.message, 401, errorData.errors, errorData.details);
  }

  if (!response.ok) {
    const errorData = await parseErrorResponse(response);
    throw new ApiError(errorData.message, response.status, errorData.errors, errorData.details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
