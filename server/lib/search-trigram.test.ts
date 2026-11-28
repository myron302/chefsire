import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { PgDialect } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { searchTrigramEnabled, searchTerm, literalContains, trigramMatch, validateTrigramSearch } from './search-trigram';

test('flag is default-off and accepts only the explicit true value', () => {
  const previous = process.env.SEARCH_TRIGRAM_ENABLED;
  try {
    for (const value of [undefined, '', 'false', 'TRUE', '1']) {
      if (value === undefined) delete process.env.SEARCH_TRIGRAM_ENABLED; else process.env.SEARCH_TRIGRAM_ENABLED = value;
      assert.equal(searchTrigramEnabled(), false);
    }
    process.env.SEARCH_TRIGRAM_ENABLED = 'true';
    assert.equal(searchTrigramEnabled(), true);
  } finally { if (previous === undefined) delete process.env.SEARCH_TRIGRAM_ENABLED; else process.env.SEARCH_TRIGRAM_ENABLED = previous; }
});

test('normalization, bounds and bound literal wildcard queries', () => {
  assert.equal(searchTerm('  Ｐasta '), 'Pasta');
  for (const q of ['x'.repeat(161), 'x\0', 'x\ny', 'ﷺ'.repeat(80)]) assert.throws(() => searchTerm(q));
  assert.equal(literalContains('50%_\\'), '%50\\%\\_\\\\%');
  const dialect = new PgDialect();
  const malicious = "abc' OR 1=1 --";
  const query = dialect.sqlToQuery(trigramMatch(sql`name`, malicious));
  assert.ok(!query.sql.includes(malicious), 'external text must be parameterized');
  assert.ok(query.params.includes(malicious.toLowerCase()));
  assert.doesNotMatch(dialect.sqlToQuery(trigramMatch(sql`name`, 'ab')).sql, /word_similarity| % /);
});

test('enabled HTTP validation rejects structured, oversized and control input before downstream work', async () => {
  const previous = process.env.SEARCH_TRIGRAM_ENABLED;
  process.env.SEARCH_TRIGRAM_ENABLED = 'true';
  let calls = 0;
  const app = express(); app.get('/', validateTrigramSearch, (_req, res) => { calls++; res.json({ ok: true }); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.on('listening', r));
  const base = `http://127.0.0.1:${(server.address() as any).port}/`;
  try {
    for (const suffix of ['?q[]=x', '?query=' + 'x'.repeat(161), '?search=x%00']) assert.equal((await fetch(base + suffix)).status, 400);
    assert.equal(calls, 0);
    assert.equal((await fetch(base + '?q=spagetti')).status, 200);
    assert.equal(calls, 1);
    delete process.env.SEARCH_TRIGRAM_ENABLED;
    assert.equal((await fetch(base + '?q[]=x')).status, 200, 'legacy mode remains untouched');
  } finally {
    await new Promise<void>(r => server.close(() => r()));
    if (previous === undefined) delete process.env.SEARCH_TRIGRAM_ENABLED; else process.env.SEARCH_TRIGRAM_ENABLED = previous;
  }
});
