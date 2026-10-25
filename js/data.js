import { firebaseConfig, COLLECTION, PAGE_SIZE } from './config.js';

// Plain fetch keeps this file dependency-free. Firestore Rules authorize requests.
// All network and Firestore-specific details live in this file.
const root = `projects/${firebaseConfig.projectId}/databases/(default)/documents`;
const api = 'https://firestore.googleapis.com/v1/';
const docName = id => `${root}/${COLLECTION}/${id}`;

export async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${api}${path}?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      cache: 'no-store',
      signal: controller.signal
    });
    const body = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      const error = new Error(body?.error?.message || 'Unable to contact the shared log.');
      error.code = body?.error?.status || String(response.status);
      throw error;
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Connection timed out. Your entry is still here; retry when connected.');
      timeoutError.code = 'TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally { clearTimeout(timeout); }
}

export function entryFields(entry) {
  return Object.fromEntries(Object.entries(entry).map(([key, value]) => [key,
    typeof value === 'number' ? { doubleValue: value } : { stringValue: value }
  ]));
}

export function decodeDocument(document) {
  const values = Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key,
    value.stringValue ?? value.timestampValue ?? value.doubleValue ??
    (value.integerValue !== undefined ? Number(value.integerValue) : null)
  ]));
  return { ...values, id: document.name.split('/').pop(), documentName: document.name };
}

export async function saveEntry(entry, id) {
  try {
    await request(`${root}:commit`, {
      method: 'POST',
      body: JSON.stringify({ writes: [{
        update: { name: docName(id), fields: entryFields(entry) },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false }
      }] })
    });
  } catch (error) {
    // A previous request may have saved even if its confirmation was lost.
    // The same ID is reused for a retry; never silently create a duplicate.
    if (['ALREADY_EXISTS', 'FAILED_PRECONDITION', 'PERMISSION_DENIED'].includes(error.code)) {
      const saved = await request(docName(id)).catch(() => null);
      if (saved) {
        const existing = decodeDocument(saved);
        if (Object.keys(entry).every(key => existing[key] === entry[key])) return id;
      }
    }
    throw error;
  }
  return id;
}

export async function loadEntries(cursor = null) {
  const structuredQuery = {
    from: [{ collectionId: COLLECTION }],
    orderBy: [
      { field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' },
      { field: { fieldPath: '__name__' }, direction: 'DESCENDING' }
    ],
    limit: PAGE_SIZE + 1
  };
  if (cursor) structuredQuery.startAt = {
    values: [{ timestampValue: cursor.createdAt }, { referenceValue: cursor.documentName }],
    before: false
  };
  const result = await request(`${root}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery }) });
  const documents = result.filter(row => row.document).map(row => decodeDocument(row.document));
  const entries = documents.slice(0, PAGE_SIZE);
  return { entries, hasMore: documents.length > PAGE_SIZE, cursor: entries.at(-1) || null };
}

export async function deleteEntry(id) {
  try { await request(docName(id), { method: 'DELETE' }); }
  catch (error) { if (error.code !== 'NOT_FOUND') throw error; }
}

export function connectionMessage(error, action) {
  if (error.code === 'PERMISSION_DENIED') return `Could not ${action}. Shared log access is not enabled yet. Your data has not been cleared.`;
  if (error.code === 'RESOURCE_EXHAUSTED') return `Could not ${action}. The free database usage limit has been reached. Please try later.`;
  if (error.code === 'TIMEOUT') return error.message;
  return `Could not ${action}. Check your internet connection and try again.`;
}
