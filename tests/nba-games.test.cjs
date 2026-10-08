const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/nba/games');
const originalFetch = global.fetch;
const originalKey = process.env.highlightly_nba;
after(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.highlightly_nba;
  else process.env.highlightly_nba = originalKey;
});
function request(url, method = 'GET') {
  const res = {
    headers: {}, code: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }
  };
  return handler({ url, method }, res).then(() => res);
}
test('invalid requests do not spend provider quota', async () => {
  global.fetch = () => { throw Error('Must not fetch'); };
  for (const url of ['/api/nba/games', '/api/nba/games?date=2026-02-30',
    '/api/nba/games?date=2026-10-07&date=2026-10-08',
    '/api/nba/games?date=2026-10-07&url=https://example.com']) {
    assert.equal((await request(url)).code, 400);
  }
  const res = await request('/api/nba/games?date=2026-10-07', 'POST');
  assert.equal(res.code, 405);
  assert.equal(res.headers.Allow, 'GET');
});
test('missing configuration fails without calling provider', async () => {
  delete process.env.highlightly_nba;
  global.fetch = () => { throw Error('Must not fetch'); };
  assert.equal((await request('/api/nba/games?date=2026-10-07')).code, 503);
});
test('key is sent only to fixed upstream; successful data is cached', async () => {
  process.env.highlightly_nba = 'test-only-secret';
  global.fetch = async (url, options) => {
    assert.equal(url.origin + url.pathname, 'https://nba.highlightly.net/matches');
    assert.equal(url.searchParams.get('league'), 'NBA');
    assert.equal(url.searchParams.get('date'), '2026-10-07');
    assert.equal(url.searchParams.get('limit'), '20');
    assert.equal(options.headers['x-rapidapi-key'], 'test-only-secret');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    return { ok: true, json: async () => ({ data: [{ id: 1 }], pagination: { totalCount: 1 }, plan: {} }) };
  };
  const res = await request('/api/nba/games?date=2026-10-07');
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.data, [{ id: 1 }]);
  assert.match(res.headers['Cache-Control'], /s-maxage=60/);
  assert.ok(!JSON.stringify(res.body).includes('test-only-secret'));
});
test('provider failures never expose sensitive details or get cached', async () => {
  process.env.highlightly_nba = 'test-only-secret';
  for (const status of [401, 403, 429, 500]) {
    global.fetch = async () => ({ ok: false, status, json: () => { throw Error('Must not read error body'); } });
    const res = await request('/api/nba/games?date=2026-10-07');
    assert.equal(res.code, status === 429 ? 429 : 502);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.ok(!JSON.stringify(res.body).includes('test-only-secret'));
  }
  global.fetch = async () => { throw Error('test-only-secret'); };
  assert.equal((await request('/api/nba/games?date=2026-10-07')).code, 502);
  global.fetch = async () => ({ ok: true, json: async () => ({ message: 'invalid' }) });
  assert.equal((await request('/api/nba/games?date=2026-10-07')).code, 502);
});
