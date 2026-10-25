import test from 'node:test';
import assert from 'node:assert/strict';
import { saveEntry, loadEntries, deleteEntry } from '../js/data.js';
const entry = { user: 'Jesus', film: 'Other:', filmOther: 'QA stock', chemical: 'D-76', chemicalOther: '', feet: 25.5 };
const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const originalFetch = global.fetch;
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
test.afterEach(() => { global.fetch = originalFetch; });

test('save creates one immutable entry with a database-generated timestamp', async () => {
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++;
    assert.match(url, /documents:commit/);
    const write = JSON.parse(options.body).writes[0];
    assert.match(write.update.name, new RegExp(id + '$'));
    assert.equal(write.update.fields.feet.doubleValue, 25.5);
    assert.equal(write.updateTransforms[0].setToServerValue, 'REQUEST_TIME');
    assert.deepEqual(write.currentDocument, { exists: false });
    return response({ commitTime: '2026-10-25T16:00:00Z' });
  };
  assert.equal(await saveEntry(entry, id), id);
  assert.equal(calls, 1);
});
test('retry recognizes an already-saved matching entry instead of duplicating it', async () => {
  let calls = 0;
  global.fetch = async () => {
    if (++calls === 1) return response({ error: { status: 'ALREADY_EXISTS' } }, 409);
    return response({ name: `projects/p/databases/(default)/documents/log_entries/${id}`, fields: Object.fromEntries(Object.entries(entry).map(([k, v]) => [k, typeof v === 'number' ? { doubleValue: v } : { stringValue: v }])) });
  };
  assert.equal(await saveEntry(entry, id), id);
  assert.equal(calls, 2);
});
test('a rejected save propagates failure for the form to retain input', async () => {
  global.fetch = async () => response({ error: { status: 'PERMISSION_DENIED', message: 'Denied' } }, 403);
  await assert.rejects(saveEntry(entry, id), error => error.code === 'PERMISSION_DENIED');
});
test('history uses bounded newest-first pagination and preserves custom values', async () => {
  global.fetch = async (_url, options) => {
    const query = JSON.parse(options.body).structuredQuery;
    assert.equal(query.limit, 51);
    assert.equal(query.orderBy[0].direction, 'DESCENDING');
    return response([{ document: { name: `projects/p/databases/(default)/documents/log_entries/${id}`, fields: { film: { stringValue: 'Other:' }, filmOther: { stringValue: 'QA stock' }, feet: { doubleValue: 25.5 }, createdAt: { timestampValue: '2026-10-25T16:00:00Z' } } } }]);
  };
  const result = await loadEntries();
  assert.equal(result.entries[0].filmOther, 'QA stock');
  assert.equal(result.entries[0].feet, 25.5);
  assert.equal(result.hasMore, false);
});
test('deletion targets the selected entry', async () => {
  global.fetch = async (url, options) => {
    assert.match(url, new RegExp(`/log_entries/${id}\\?`));
    assert.equal(options.method, 'DELETE');
    return response({});
  };
  await deleteEntry(id);
});
