import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, apiFetch } from '@/lib/apiClient';

// A 401 that arrives after the person has already left the page that asked must not send the tab
// to /login: a slow request left behind by the page they signed out of did exactly that to a
// visitor on the public home page.

const location = { pathname: '/dashboard/properties/p1', href: '' };

beforeEach(() => {
  location.pathname = '/dashboard/properties/p1';
  location.href = '';
  vi.stubGlobal('window', { location });
  // The refresh that follows a 401 fails, as it does once a session has been signed out.
  vi.spyOn(axios, 'post').mockRejectedValue(new Error('no session'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
    status: 401,
    statusText: 'Unauthorized',
    data: {},
    headers: {},
    config,
  });
}

describe('apiFetch after a 401 that cannot be refreshed', () => {
  it('sends the page that asked to /login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    await apiFetch('/api/v1/properties/p1/announcements');
    expect(location.href).toBe('/login');
  });

  it('leaves a visitor who has since moved to another page where they are', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        location.pathname = '/';
        return new Response(null, { status: 401 });
      }),
    );
    await apiFetch('/api/v1/properties/p1/announcements');
    expect(location.href).toBe('');
  });
});

describe('apiClient after a 401 that cannot be refreshed', () => {
  it('sends the page that asked to /login', async () => {
    apiClient.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };
    await expect(apiClient.get('/api/v1/properties/p1/equipment')).rejects.toBeTruthy();
    expect(location.href).toBe('/login');
  });

  it('leaves a visitor who has since moved to another page where they are', async () => {
    apiClient.defaults.adapter = async (config) => {
      location.pathname = '/';
      throw unauthorized(config);
    };
    await expect(apiClient.get('/api/v1/properties/p1/equipment')).rejects.toBeTruthy();
    expect(location.href).toBe('');
  });
});
