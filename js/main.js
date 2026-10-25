import { initMonitor } from './monitor.js';
import { USERS, FILMS, CHEMICALS, OTHER, DEFAULT_FEET, validateEntry, prepareEntry, selectionText, fieldError } from './form-rules.js';
import { Dropdown } from './dropdown.js';
import { saveEntry, loadEntries, deleteEntry, connectionMessage } from './data.js';
import { enterView } from './animations.js';

const $ = selector => document.querySelector(selector);
const form = $('#log-form');
const formFields = $('#form-fields');
const errorBox = $('#form-error');
const saveStatus = $('#save-status');
const submit = $('#submit-button');
const historySection = $('#history');
const historyList = $('#history-list');
const historyStatus = $('#history-status');
const loadMore = $('#load-more');
const retryHistory = $('#retry-history');
const dialog = $('#delete-dialog');
const yes = $('#delete-yes');
const no = $('#delete-no');
const deleteError = $('#delete-error');
let saving = false;
let deleting = false;
let selectedForDeletion = null;
let deleteTrigger = null;
let entries = [];
let cursor = null;
let hasMore = false;
let loadingHistory = false;
let lastHistoryLoad = 0;
let historyVersion = 0;

function selectChanged(field, value) {
  clearInvalid(field);
  saveStatus.textContent = '';
  if (field === 'film' || field === 'chemical') {
    const otherRow = $(`#${field}-other-row`);
    otherRow.hidden = value !== OTHER;
    $(`#${field}-other`).required = value === OTHER;
    if (value === OTHER) $(`#${field}-other`).focus();
    else $(`#${field}-other`).value = '';
  }
}
const dropdowns = {
  user: new Dropdown($('#user-select'), 'user', USERS, value => selectChanged('user', value)),
  film: new Dropdown($('#film-select'), 'film', FILMS, value => selectChanged('film', value)),
  chemical: new Dropdown($('#chemical-select'), 'chemical', CHEMICALS, value => selectChanged('chemical', value))
};
document.addEventListener('dropdown-opening', event => {
  Object.values(dropdowns).forEach(dropdown => {
    if (dropdown.field !== event.detail) dropdown.close();
  });
});

function values() {
  return {
    user: dropdowns.user.value,
    film: dropdowns.film.value,
    filmOther: $('#film-other').value,
    chemical: dropdowns.chemical.value,
    chemicalOther: $('#chemical-other').value,
    feet: $('#feet').value
  };
}
function fieldInput(field) {
  const name = field.toLowerCase();
  if (name === 'feet') return $('#feet');
  if ((name === 'film' || name === 'chemical') && dropdowns[name].value === OTHER) return $(`#${name}-other`);
  return dropdowns[name].trigger;
}
function clearInvalid(field) {
  const name = field.toLowerCase();
  const targets = name === 'feet' ? [$('#feet')] : [dropdowns[name].trigger, $(`#${name}-other`)];
  targets.filter(Boolean).forEach(input => {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  });
  if (errorBox.dataset.field === name) { errorBox.hidden = true; errorBox.textContent = ''; delete errorBox.dataset.field; }
}
function showInvalid(field) {
  errorBox.textContent = fieldError(field);
  errorBox.dataset.field = field.toLowerCase();
  errorBox.hidden = false;
  const input = fieldInput(field);
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', 'form-error');
  input.focus({ preventScroll: true });
  errorBox.scrollIntoView({ block: 'nearest' });
}
form.addEventListener('input', event => {
  const field = event.target.id === 'feet' ? 'feet' : event.target.id.split('-')[0];
  if (['feet', 'film', 'chemical'].includes(field)) clearInvalid(field);
  saveStatus.textContent = '';
});
$('#feet').addEventListener('focus', event => {
  if (event.target.value === DEFAULT_FEET) event.target.select();
});

function submissionId(entry) {
  const fingerprint = JSON.stringify(entry);
  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem('chemical-log-pending')); } catch { /* Storage may be unavailable in private browsing. */ }
  if (pending?.fingerprint === fingerprint && /^[a-f0-9-]{36}$/.test(pending.id)) return pending.id;
  const id = crypto.randomUUID();
  try { sessionStorage.setItem('chemical-log-pending', JSON.stringify({ id, fingerprint })); } catch { /* Saving to Firestore still works. */ }
  return id;
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving) return;
  Object.values(dropdowns).forEach(dropdown => dropdown.close());
  saveStatus.textContent = '';
  const data = values();
  const invalidField = validateEntry(data);
  if (invalidField) { showInvalid(invalidField); return; }
  errorBox.hidden = true;
  errorBox.textContent = '';
  const entry = prepareEntry(data);
  const id = submissionId(entry);
  saving = true;
  formFields.disabled = true;
  submit.disabled = true;
  submit.textContent = 'SAVING...';
  form.setAttribute('aria-busy', 'true');
  try {
    await saveEntry(entry, id);
    // Reset only after the database confirms the save. Stay on New Log.
    form.reset();
    Object.values(dropdowns).forEach(dropdown => dropdown.reset());
    for (const field of ['film', 'chemical']) {
      $(`#${field}-other-row`).hidden = true;
      $(`#${field}-other`).required = false;
      $(`#${field}-other`).value = '';
    }
    $('#feet').value = DEFAULT_FEET;
    try { sessionStorage.removeItem('chemical-log-pending'); } catch { /* Optional browser storage. */ }
    saveStatus.textContent = 'Entry saved.';
    lastHistoryLoad = 0;
  } catch (error) {
    saveStatus.textContent = connectionMessage(error, 'confirm the save');
  } finally {
    saving = false;
    formFields.disabled = false;
    submit.disabled = false;
    submit.textContent = 'SUBMIT';
    form.removeAttribute('aria-busy');
  }
});

function renderEntry(entry) {
  const article = document.createElement('article');
  article.className = 'history-entry';
  article.dataset.entryId = entry.id;
  const details = document.createElement('dl');
  details.className = 'entry-details';
  const date = new Date(entry.createdAt);
  // Display dates in the collective's Toronto timezone, regardless of device timezone.
  const dateText = Number.isNaN(date.valueOf()) ? 'Unknown date' : new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Toronto'
  }).format(date);
  const rows = [
    ['Date', dateText], ['User', entry.user], ['Film', selectionText(entry, 'film')],
    ['Chemical', selectionText(entry, 'chemical')], ['Feet', String(entry.feet)]
  ];
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'entry-line';
    const term = document.createElement('dt');
    term.textContent = `${label} :`;
    const description = document.createElement('dd');
    // User-entered Other values are always text, never injected HTML.
    description.textContent = value;
    row.append(term, description);
    details.append(row);
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pink-button delete-button';
  button.textContent = 'X';
  button.setAttribute('aria-label', `Delete log by ${entry.user} from ${dateText}`);
  button.addEventListener('click', () => {
    selectedForDeletion = entry;
    deleteTrigger = button;
    deleteError.hidden = true;
    deleteError.textContent = '';
    dialog.showModal();
    no.focus();
  });
  article.append(details, button);
  return article;
}
function renderHistory() {
  historyList.replaceChildren(...entries.map(renderEntry));
  loadMore.hidden = !hasMore;
}
async function refreshHistory(append = false) {
  if (loadingHistory) return;
  loadingHistory = true;
  const version = ++historyVersion;
  historyStatus.textContent = append ? 'Loading more entries...' : 'Loading history...';
  historySection.setAttribute('aria-busy', 'true');
  retryHistory.hidden = true;
  loadMore.disabled = true;
  try {
    const result = await loadEntries(append ? cursor : null);
    if (version !== historyVersion) return;
    const combined = append ? [...entries, ...result.entries] : result.entries;
    entries = [...new Map(combined.map(entry => [entry.id, entry])).values()];
    cursor = result.cursor;
    hasMore = result.hasMore;
    lastHistoryLoad = Date.now();
    renderHistory();
    historyStatus.textContent = entries.length ? '' : 'No entries yet.';
  } catch (error) {
    historyStatus.textContent = connectionMessage(error, 'load history');
    retryHistory.hidden = false;
  } finally {
    loadingHistory = false;
    loadMore.disabled = false;
    historySection.removeAttribute('aria-busy');
  }
}
loadMore.addEventListener('click', () => refreshHistory(true));
retryHistory.addEventListener('click', () => refreshHistory(false));

function closeDelete() { if (!deleting) dialog.close(); }
no.addEventListener('click', closeDelete);
dialog.addEventListener('cancel', event => { if (deleting) event.preventDefault(); });
dialog.addEventListener('close', () => {
  selectedForDeletion = null;
  if (deleteTrigger?.isConnected) deleteTrigger.focus({ preventScroll: true });
  else $('#history .delete-button')?.focus({ preventScroll: true });
});
yes.addEventListener('click', async () => {
  if (!selectedForDeletion || deleting) return;
  deleting = true;
  yes.disabled = no.disabled = true;
  yes.textContent = '...';
  deleteError.hidden = true;
  const entry = selectedForDeletion;
  try {
    await deleteEntry(entry.id);
    entries = entries.filter(item => item.id !== entry.id);
    renderHistory();
    historyStatus.textContent = entries.length ? 'Entry deleted.' : hasMore ? 'Entry deleted. Load more to see older entries.' : 'No entries yet.';
    dialog.close();
  } catch (error) {
    deleteError.textContent = connectionMessage(error, 'delete the entry');
    deleteError.hidden = false;
  } finally {
    deleting = false;
    yes.disabled = no.disabled = false;
    yes.textContent = 'YES';
  }
});

function navigate() {
  const view = location.hash === '#history' ? 'history' : 'new-log';
  $('#new-log').hidden = view !== 'new-log';
  historySection.hidden = view !== 'history';
  Object.values(dropdowns).forEach(dropdown => dropdown.close());
  for (const link of document.querySelectorAll('.nav-link')) {
    if (link.hash === `#${view}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  enterView($(`#${view}`));
  if (view === 'history') refreshHistory(false);
}
window.addEventListener('hashchange', navigate);
// Clicking History again is an explicit refresh, including on desktop.
document.querySelector('a[href="#history"]').addEventListener('click', () => {
  if (location.hash === '#history') refreshHistory(false);
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && location.hash === '#history' && Date.now() - lastHistoryLoad > 30000) refreshHistory(false);
});
window.addEventListener('online', () => {
  if (location.hash === '#history') refreshHistory(false);
});
navigate();

// Decorative effects must never interrupt the log controls.
try { initMonitor(); } catch (error) { console.info('Monitor effect unavailable.', error); }

