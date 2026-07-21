const ARABIC_OR_HEBREW = /[\u0590-\u08ff]/;
const LATIN = /[A-Za-z]/;

export function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

export function textToHtml(value = '') {
  const lines = String(value).split(/\r?\n/);
  return lines.map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`).join('');
}

export function stripHtml(html = '') {
  if (typeof DOMParser !== 'undefined') {
    const documentValue = new DOMParser().parseFromString(String(html), 'text/html');
    return (documentValue.body.textContent || '').replace(/\u00a0/g, ' ').trim();
  }
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function noteDisplayTitle(note) {
  const explicit = String(note?.title || '').trim();
  if (explicit) return explicit;
  const firstLine = String(note?.plainText || note?.text || '').split(/\r?\n/)[0].trim();
  return firstLine.slice(0, 80) || 'ملاحظة بلا عنوان';
}

export function detectTextDirection(value = '') {
  const text = String(value).trim();
  for (const character of text) {
    if (ARABIC_OR_HEBREW.test(character)) return 'rtl';
    if (LATIN.test(character)) return 'ltr';
  }
  return 'rtl';
}

export function formatDate(timestamp, options = {}) {
  const date = new Date(timestamp || Date.now());
  const locale = options.locale || 'ar-EG';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: options.long ? 'long' : 'short',
    year: date.getFullYear() === new Date().getFullYear() && !options.alwaysYear ? undefined : 'numeric',
    ...(options.time ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(date);
}

export function checklistProgress(html = '') {
  if (typeof DOMParser === 'undefined') return { complete: 0, total: 0 };
  const documentValue = new DOMParser().parseFromString(String(html), 'text/html');
  const items = [...documentValue.querySelectorAll('[data-type="taskItem"], li[data-checked]')];
  return {
    total: items.length,
    complete: items.filter((item) => item.getAttribute('data-checked') === 'true').length,
  };
}

export function noteMatchesSearch(note, query, folderName = '') {
  const normalized = String(query || '').trim().toLocaleLowerCase();
  if (!normalized) return true;
  const haystack = [
    note.title,
    note.plainText,
    note.text,
    ...(note.tags || []),
    folderName,
  ].join(' ').toLocaleLowerCase();
  return normalized.split(/\s+/).every((term) => haystack.includes(term));
}

export function sortNotes(notes, sort) {
  return [...notes].sort((first, second) => {
    if (sort === 'created') return (second.createdAt || 0) - (first.createdAt || 0);
    if (sort === 'title') return noteDisplayTitle(first).localeCompare(noteDisplayTitle(second), 'ar', { sensitivity: 'base' });
    if (sort === 'pinned') return Number(second.pinned) - Number(first.pinned) || (second.updatedAt || 0) - (first.updatedAt || 0);
    return (second.updatedAt || 0) - (first.updatedAt || 0);
  });
}

export function highlightParts(value, query) {
  const text = String(value || '');
  const term = String(query || '').trim();
  if (!term) return [{ text, match: false }];
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.split(new RegExp(`(${escaped})`, 'giu')).filter(Boolean).map((part) => ({
    text: part,
    match: part.toLocaleLowerCase() === term.toLocaleLowerCase(),
  }));
}

export function bytesLabel(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
