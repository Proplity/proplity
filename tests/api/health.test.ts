import { describe, expect, it } from 'vitest';
import { apiFetch } from '../helpers/client';

describe('health', () => {
  it('reports ok with a reachable database, unauthenticated', async () => {
    // No cookie on purpose: an uptime monitor has no session, so requiring
    // one would make the check useless as a health probe.
    const res = await apiFetch('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('up');
    expect(typeof res.body.latencyMs).toBe('number');
  });

  it('leaks nothing about the deployment', async () => {
    const res = await apiFetch('/api/v1/health');
    const keys = Object.keys(res.body).sort();
    expect(keys).toEqual(['database', 'latencyMs', 'status']);
  });
});
