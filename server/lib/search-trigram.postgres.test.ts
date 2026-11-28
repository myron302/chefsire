import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PG_URL, connectLocalPg, ddl } from '../test-support/authz-pg-harness';

// Missing test configuration is a failure, never a skipped green CI batch.
assert.ok(PG_URL, 'CS_TEST_PG_URL must point at a disposable loopback test database');
const local = await connectLocalPg();
const previous = process.env.SEARCH_TRIGRAM_ENABLED;
test.after(async () => { if (previous === undefined) delete process.env.SEARCH_TRIGRAM_ENABLED; else process.env.SEARCH_TRIGRAM_ENABLED = previous; await local.end(); });
const schema = await import('../../shared/schema');
await local.query(`DROP TABLE IF EXISTS products, recipes, posts, users, clubs, club_memberships CASCADE;
  ${ddl(schema.users, 'users', ', UNIQUE(username), UNIQUE(email)')};
  ${ddl(schema.products, 'products')}; ${ddl(schema.recipes, 'recipes')};
  ${ddl(schema.posts, 'posts')}; ${ddl(schema.clubs, 'clubs')}; ${ddl(schema.clubMemberships, 'club_memberships')};
  TRUNCATE account_status;`);
const { storage } = await import('../storage');
const { RecipeService } = await import('../services/recipe.service');
const { db } = await import('../db');
const owner = (await local.query(`INSERT INTO users(username,email,password,display_name) VALUES ('whiskey','a@test','x','Whiskey Chef') RETURNING id`)).rows[0].id;
const hidden: string[] = [];
for (const [i, status] of ['suspended', 'deactivated', 'closed'].entries()) {
  const id = (await local.query(`INSERT INTO users(username,email,password,display_name) VALUES ($1,$2,'x','Whiskey Hidden') RETURNING id`, [`whiskeyhidden${i}`, `${i}@test`])).rows[0].id;
  hidden.push(id);
  await local.query(`INSERT INTO account_status(user_id,status) VALUES ($1,$2)`, [id,status]);
}
for (const [name, seller, active, category] of [
  ['Whiskey',owner,true,'ingredients'], ['Bourbon Whiskey',owner,true,'ingredients'],
  ['Whiskey inactive',owner,false,'ingredients'], ...hidden.map(id => ['Whiskey hidden', id, true, 'ingredients'])
]) await local.query(`INSERT INTO products(seller_id,name,description,price,category,is_active,pickup_location) VALUES ($1,$2,'A bottle',10,$4,$3,'NY')`, [seller,name,active,category]);
const club = (await local.query(`INSERT INTO clubs(creator_id,name,is_public) VALUES ($1,'secret',false) RETURNING id`, [owner])).rows[0].id;
await local.query(`INSERT INTO recipes(title,ingredients,instructions,origin_club_id) VALUES
  ('Spaghetti','["tomato"]','["cook"]',NULL), ('Spaghetti Bolognese','["beef"]','["cook"]',NULL),
  ('Spaghetti Secret','["secret"]','["secret"]',$1)`, [club]);
const searchRecipes = (q: string, viewerId?: string) => RecipeService.searchLocalRecipes(db, { q, viewerId });
const migration = await fs.readFile(new URL('../../docs/sql-pending/search-trigram-phase1.sql.txt', import.meta.url), 'utf8');
const apply = async () => { for (const statement of migration.replace(/^--.*$/gm, '').split(';').filter(s => s.trim())) await local.query(statement); };

test('default-off keeps existing matching and does not require pg_trgm', async () => {
  delete process.env.SEARCH_TRIGRAM_ENABLED;
  // Assert the generated SQL stays extension-free even if a preceding suite installed pg_trgm.
  const queries: string[] = [];
  const query = local.query.bind(local);
  (local as any).query = (q: any, ...args: any[]) => { queries.push(typeof q === 'string' ? q : q.text); return (query as any)(q,...args); };
  try {
    assert.equal((await storage.searchProducts('wiskey')).length, 0);
    assert.equal((await storage.searchProducts('whisk')).length, 2);
    assert.equal((await searchRecipes('spagetti')).length, 0);
    await storage.searchUsers('whisk');
    assert.doesNotMatch(queries.join('\n'), /similarity\(| % | %> /);
  } finally { (local as any).query = query; }
});

test('manual additive migration is rerunnable and enabled search ranks exact names first', async () => {
  await apply(); await apply();
  process.env.SEARCH_TRIGRAM_ENABLED = 'true';
  assert.deepEqual((await storage.searchProducts('whiskey')).map(p => p.name), ['Whiskey','Bourbon Whiskey']);
  assert.deepEqual((await storage.searchProducts('wiskey')).map(p => p.name), ['Whiskey','Bourbon Whiskey']);
  assert.deepEqual((await searchRecipes('spagetti')).map(r => r.title), ['Spaghetti','Spaghetti Bolognese']);
  assert.equal((await searchRecipes('spaghetti'))[0].title, 'Spaghetti');
  assert.equal((await storage.searchUsers('whiskey'))[0].username, 'whiskey');
  assert.deepEqual((await storage.searchUsers('wiskey')).map(u => u.username), ['whiskey']);
});

test('fuzzy candidates preserve club privacy, inactive/hidden-seller filtering and category/location filters', async () => {
  process.env.SEARCH_TRIGRAM_ENABLED = 'true';
  assert.ok(!(await searchRecipes('spagetti')).some(r => r.title.includes('Secret')));
  assert.ok((await searchRecipes('spagetti', owner)).some(r => r.title.includes('Secret')));
  assert.equal((await storage.searchProducts('wiskey','ingredients','NY')).length, 2);
  assert.equal((await storage.searchProducts('wiskey','tools')).length, 0);
  assert.equal((await storage.searchProducts('wiskey',undefined,'LA')).length, 0);
  const sellerProducts = await storage.searchProducts('Whiskey Chef');
  assert.equal(sellerProducts.length, 2, 'seller display-name discovery must return real active products');
  assert.ok(sellerProducts.every(p => p.sellerId === owner));
});

test('short/partial/literal wildcard and injection-like input remain bounded matches', async () => {
  process.env.SEARCH_TRIGRAM_ENABLED = 'true';
  assert.equal((await storage.searchProducts('wh')).length, 2);
  assert.equal((await storage.searchProducts('50%_')).length, 0);
  assert.equal((await storage.searchProducts("x' OR 1=1 --")).length, 0);
  assert.equal((await storage.searchProducts('zzzzzzzzz')).length, 0);
});

test('20k-product corpus selects the trigram index for the actual candidate predicate', async () => {
  process.env.SEARCH_TRIGRAM_ENABLED = 'true';
  await local.query(`INSERT INTO products(seller_id,name,description,price,category) SELECT $1,'Kitchen item ' || i,md5(i::text),1,'tools' FROM generate_series(1,20000) i`, [owner]);
  await local.query('VACUUM ANALYZE products');
  const { PgDialect } = await import('drizzle-orm/pg-core');
  const { sql } = await import('drizzle-orm');
  const { trigramMatch } = await import('./search-trigram');
  const query = new PgDialect().sqlToQuery(sql`SELECT id FROM products WHERE ${trigramMatch(schema.products.name,'wiskey')}`);
  const plan = (await local.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${query.sql}`,query.params)).rows[0]['QUERY PLAN'];
  assert.match(JSON.stringify(plan), /search_products_name_trgm_idx/);
  console.log('local 20k candidate execution milliseconds:', plan[0]['Execution Time']);
  assert.ok((await storage.searchProducts('wiskey')).length >= 2);
});

test('flag-off rollback remains usable without the new indexes', async () => {
  delete process.env.SEARCH_TRIGRAM_ENABLED;
  for (const name of ['search_recipes_title_trgm_idx','search_users_username_trgm_idx','search_users_display_name_trgm_idx','search_products_name_trgm_idx']) await local.query(`DROP INDEX CONCURRENTLY IF EXISTS ${name}`);
  assert.equal((await storage.searchProducts('wiskey')).length, 0);
  assert.equal((await storage.searchProducts('whisk')).length, 2);
  assert.ok((await searchRecipes('spaghetti')).length >= 2);
});
