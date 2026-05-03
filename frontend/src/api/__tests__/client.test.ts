import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '@/api/client';
import { ApiError, RateLimitError } from '@/types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html' },
  });
}

describe('apiClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('successful requests', () => {
    it('sends GET request with credentials: include', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: '1' }));

      await apiClient('/api/auth/me');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.credentials).toBe('include');
      expect(init.method).toBe('GET');
    });

    it('sends POST request with JSON body and Content-Type header', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: '1' }));

      await apiClient('/api/auth/login', {
        method: 'POST',
        body: { email: 'test@example.com', password: 'secret' },
      });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ email: 'test@example.com', password: 'secret' }));
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });

    it('handles 204 No Content responses', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 204, headers: { 'content-type': 'application/json' } }),
      );

      const result = await apiClient<void>('/api/auth/logout');

      expect(result).toBeUndefined();
    });

    it('constructs full URL from BASE_URL and endpoint', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: '1' }));

      await apiClient('/api/auth/me');

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain('/api/auth/me');
    });

    it('parses JSON response body', async () => {
      const user = { id: '1', email: 'test@example.com' };
      mockFetch.mockResolvedValueOnce(jsonResponse(user));

      const result = await apiClient('/api/auth/me');

      expect(result).toEqual(user);
    });
  });

  describe('401 handling', () => {
    let authExpiredHandler: EventListener;
    let authExpiredCallCount: number;

    beforeEach(() => {
      authExpiredCallCount = 0;
      authExpiredHandler = () => { authExpiredCallCount++; };
      window.addEventListener('auth:expired', authExpiredHandler);
    });

    afterEach(() => {
      window.removeEventListener('auth:expired', authExpiredHandler);
    });

    it('dispatches auth:expired event on 401 for non-auth endpoints', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401));

      await expect(apiClient('/api/users')).rejects.toThrow(ApiError);

      expect(authExpiredCallCount).toBe(1);
    });

    it('does NOT dispatch auth:expired on 401 for /api/auth/login', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ message: 'Invalid email or password.' }, 401),
      );

      await expect(apiClient('/api/auth/login', { method: 'POST', body: {} })).rejects.toThrow(
        ApiError,
      );

      expect(authExpiredCallCount).toBe(0);
    });

    it('does NOT dispatch auth:expired on 401 for /api/auth/register', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ message: 'Registration not available.' }, 401),
      );

      await expect(apiClient('/api/auth/register', { method: 'POST', body: {} })).rejects.toThrow(
        ApiError,
      );

      expect(authExpiredCallCount).toBe(0);
    });

    it('throws ApiError with status 401 and parsed message', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Session expired' }, 401));

      try {
        await apiClient('/api/users');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.status).toBe(401);
        expect(apiError.message).toBe('Session expired');
      }
    });

    it('throws ApiError with fallback message for non-JSON 401 response', async () => {
      mockFetch.mockResolvedValueOnce(textResponse('<html>Unauthorized</html>', 401));

      try {
        await apiClient('/api/users');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.status).toBe(401);
      }
    });

    it('includes field errors from 401 response', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          {
            message: 'Unauthorized',
            errors: [{ field: 'email', message: 'Email not found' }],
          },
          401,
        ),
      );

      try {
        await apiClient('/api/auth/login');
        expect.fail('Should have thrown');
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.fieldErrors).toEqual([{ field: 'email', message: 'Email not found' }]);
      }
    });
  });

  describe('429 handling', () => {
    it('throws RateLimitError on 429 response', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ message: 'Rate limit exceeded' }, 429),
      );

      await expect(apiClient('/api/auth/login')).rejects.toThrow(RateLimitError);
    });

    it('RateLimitError has status 429 and message from response', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ message: 'Too many login attempts' }, 429),
      );

      try {
        await apiClient('/api/auth/login');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        const rateError = error as RateLimitError;
        expect(rateError.status).toBe(429);
        expect(rateError.message).toBe('Too many login attempts');
      }
    });

    it('RateLimitError is also an instance of ApiError', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Rate limited' }, 429));

      await expect(apiClient('/api/auth/login')).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('other errors', () => {
    it('throws ApiError with correct status for 400', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Bad request' }, 400));

      try {
        await apiClient('/api/users');
        expect.fail('Should have thrown');
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.message).toBe('Bad request');
      }
    });

    it('throws ApiError with correct status for 403', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Forbidden' }, 403));

      try {
        await apiClient('/api/users');
        expect.fail('Should have thrown');
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(403);
      }
    });

    it('throws ApiError with correct status for 500', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Internal server error' }, 500));

      try {
        await apiClient('/api/users');
        expect.fail('Should have thrown');
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(500);
      }
    });

    it('includes field errors from response body', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          {
            message: 'Validation failed',
            errors: [
              { field: 'email', message: 'Email is required' },
              { field: 'password', message: 'Password too short' },
            ],
          },
          422,
        ),
      );

      try {
        await apiClient('/api/auth/register', { method: 'POST', body: {} });
        expect.fail('Should have thrown');
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.fieldErrors).toHaveLength(2);
        expect(apiError.fieldErrors[0]).toEqual({ field: 'email', message: 'Email is required' });
      }
    });

    it('handles non-JSON error responses gracefully', async () => {
      mockFetch.mockResolvedValueOnce(textResponse('<html>Bad Gateway</html>', 502));

      try {
        await apiClient('/api/users');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.status).toBe(502);
        expect(apiError.fieldErrors).toEqual([]);
      }
    });

    it('handles empty error responses gracefully', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

      try {
        await apiClient('/api/users');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.status).toBe(500);
      }
    });
  });

  describe('FastAPI error shapes', () => {
    it('parses HTTPException(detail="msg") into message', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ detail: 'Not found' }, 404));

      try {
        await apiClient('/api/users/999');
        expect.fail('Should have thrown');
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.message).toBe('Not found');
        expect(apiError.fieldErrors).toEqual([]);
        expect(apiError.details).toEqual({});
      }
    });

    it('parses HTTPException(detail={...}) and extracts inner message and details', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          { detail: { detail: 'Registration restricted', whitelistRestricted: true } },
          403,
        ),
      );

      try {
        await apiClient('/api/auth/register', { method: 'POST', body: {} });
        expect.fail('Should have thrown');
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.message).toBe('Registration restricted');
        expect(apiError.details).toEqual({ whitelistRestricted: true });
      }
    });

    it('parses Pydantic validation error array into fieldErrors', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          {
            detail: [
              { loc: ['body', 'email'], msg: 'value is not a valid email', type: 'value_error.email' },
              { loc: ['body', 'password'], msg: 'ensure this value has at least 8 characters', type: 'value_error.any_str.min_length' },
            ],
          },
          422,
        ),
      );

      try {
        await apiClient('/api/auth/register', { method: 'POST', body: {} });
        expect.fail('Should have thrown');
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.fieldErrors).toEqual([
          { field: 'email', message: 'value is not a valid email' },
          { field: 'password', message: 'ensure this value has at least 8 characters' },
        ]);
        expect(apiError.message).toBe('value is not a valid email');
      }
    });
  });
});
