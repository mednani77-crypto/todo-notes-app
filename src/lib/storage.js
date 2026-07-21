import DOMPurify from 'dompurify';
import {
  DEFAULT_SETTINGS,
  NOTE_COLORS,
  SCHEMA_VERSION,
  STORAGE_KEYS,
} from '../constants.js';
import { createId, stripHtml, textToHtml } from './noteUtils.js';

const allowedColors = new Set(NOTE_COLORS.map((color) => color.id));

export function sanitizeNoteHtml(value = '') {
  return DOMPurify.sanitize(String(value), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
  });
}

function normalizedTags(tags) {
  return [...new Set((Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 20))];
}

function normalizedAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments.filter((item) => item && typeof item === 'object' && item.id).map((item) => ({
    id: String(item.id),
    name: String(item.name || 'attachment').slice(0, 160),
    type: String(item.type || 'application/octet-stream').slice(0, 100),
    size: Number.isFinite(Number(item.size)) ? Number(item.size) : 0,
    kind: item.kind === 'audio' ? 'audio' : item.kind === 'image' ? 'image' : 'file',
    createdAt: Number(item.createdAt) || Date.now(),
  }));
}

export function normalizeNote(input, now = Date.now()) {
  const source = input && typeof input === 'object' ? input : { text: String(input ?? '') };
  const legacyText = typeof source.text === 'string' ? source.text : '';
  const hasStructuredContent = typeof source.content === 'string';
  const content = sanitizeNoteHtml(hasStructuredContent ? source.content : textToHtml(legacyText));
  const plainText = typeof source.plainText === 'string'
    ? source.plainText
    : hasStructuredContent ? stripHtml(content) : legacyText;
  const createdAt = Number(source.createdAt) || now;
  const trashedAt = source.trashedAt ? Number(source.trashedAt) : null;

  return {
    ...source,
    id: source.id ? String(source.id) : createId(),
    schemaVersion: SCHEMA_VERSION,
    title: typeof source.title === 'string' ? source.title.slice(0, 240) : '',
    content,
    plainText,
    // Kept for backwards compatibility with the deployed v1 application.
    text: plainText,
    completed: Boolean(source.completed),
    pinned: Boolean(source.pinned),
    favorite: Boolean(source.favorite),
    archived: Boolean(source.archived),
    trashedAt: Number.isFinite(trashedAt) ? trashedAt : null,
    folderId: source.folderId ? String(source.folderId) : null,
    tags: normalizedTags(source.tags),
    color: allowedColors.has(source.color) ? source.color : 'sand',
    cover: typeof source.cover === 'string' ? source.cover : 'none',
    attachments: normalizedAttachments(source.attachments),
    createdAt,
    updatedAt: Number(source.updatedAt) || createdAt,
  };
}

function parseArray(storage, key, recoveryKey) {
  const raw = storage.getItem(key);
  if (raw === null) return { value: [], raw: null, error: null };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new TypeError('Expected an array');
    return { value: parsed, raw, error: null };
  } catch {
    try { storage.setItem(recoveryKey, raw); } catch { /* best-effort recovery copy */ }
    console.warn(`Stored workspace data at ${key} could not be parsed; the raw value was preserved for recovery.`);
    return { value: [], raw, error: 'corrupt' };
  }
}

function parseSettings(storage) {
  const raw = storage.getItem(STORAGE_KEYS.settings);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? { ...DEFAULT_SETTINGS, ...parsed } : { ...DEFAULT_SETTINGS };
  } catch {
    try { storage.setItem(`${STORAGE_KEYS.recovery}:settings`, raw); } catch { /* best effort */ }
    return { ...DEFAULT_SETTINGS };
  }
}

export function loadWorkspace(storage = window.localStorage) {
  const storedNotes = parseArray(storage, STORAGE_KEYS.notes, STORAGE_KEYS.recovery);
  const storedFolders = parseArray(storage, STORAGE_KEYS.folders, `${STORAGE_KEYS.recovery}:folders`);
  const version = Number(storage.getItem(STORAGE_KEYS.schema) || 1);
  const migrationRequired = version < SCHEMA_VERSION;

  if (migrationRequired && storedNotes.raw !== null && !storage.getItem(STORAGE_KEYS.legacyBackup)) {
    try { storage.setItem(STORAGE_KEYS.legacyBackup, storedNotes.raw); } catch { /* backup failure is reported by persistence later */ }
  }

  const notes = storedNotes.value.map((note) => normalizeNote(note));
  const folders = storedFolders.value.filter((folder) => folder && typeof folder === 'object').map((folder) => ({
    id: folder.id ? String(folder.id) : createId(),
    name: String(folder.name || 'مجلد بلا اسم').trim().slice(0, 80),
    createdAt: Number(folder.createdAt) || Date.now(),
  }));

  if (!storedNotes.error) {
    try { storage.setItem(STORAGE_KEYS.schema, String(SCHEMA_VERSION)); } catch { /* handled when saving */ }
  }

  return {
    notes,
    folders,
    settings: parseSettings(storage),
    storageError: storedNotes.error ? 'legacy-corrupt' : null,
    shouldPersistMigration: migrationRequired && !storedNotes.error,
    recoveryRaw: storedNotes.error ? storedNotes.raw : null,
  };
}

export function saveWorkspace({ notes, folders, settings }, storage = window.localStorage) {
  storage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes.map((note) => normalizeNote(note))));
  storage.setItem(STORAGE_KEYS.folders, JSON.stringify(folders));
  storage.setItem(STORAGE_KEYS.settings, JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }));
  storage.setItem(STORAGE_KEYS.schema, String(SCHEMA_VERSION));
}

export function createEmptyNote(overrides = {}) {
  const timestamp = Date.now();
  return normalizeNote({
    id: createId(),
    title: '',
    content: '<p></p>',
    plainText: '',
    text: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }, timestamp);
}

export function buildBackup({ notes, folders, settings }) {
  return {
    type: 'todo-notes-app-backup',
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    notes: notes.map((note) => normalizeNote(note)),
    folders: folders.map((folder) => ({ ...folder })),
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };
}

export function validateBackup(input) {
  if (!input || typeof input !== 'object' || input.type !== 'todo-notes-app-backup') {
    throw new TypeError('هذا الملف ليس نسخة احتياطية صالحة من ملاحظاتي.');
  }
  if (!Number.isFinite(Number(input.version)) || !Array.isArray(input.notes) || !Array.isArray(input.folders || [])) {
    throw new TypeError('بنية النسخة الاحتياطية غير مكتملة.');
  }
  if (input.notes.length > 10000) throw new RangeError('تحتوي النسخة على عدد ملاحظات يتجاوز الحد الآمن.');
  return {
    version: Number(input.version),
    notes: input.notes.map((note) => normalizeNote(note)),
    folders: (input.folders || []).map((folder) => ({
      id: folder.id ? String(folder.id) : createId(),
      name: String(folder.name || 'مجلد بلا اسم').slice(0, 80),
      createdAt: Number(folder.createdAt) || Date.now(),
    })),
    settings: { ...DEFAULT_SETTINGS, ...(input.settings || {}) },
  };
}

export function mergeBackups(current, imported) {
  const folderIds = new Set(current.folders.map((folder) => folder.id));
  const folders = [...current.folders];
  for (const folder of imported.folders) {
    if (!folderIds.has(folder.id)) {
      folderIds.add(folder.id);
      folders.push(folder);
    }
  }

  const noteIds = new Set(current.notes.map((note) => note.id));
  const notes = [...current.notes];
  for (const importedNote of imported.notes) {
    const note = noteIds.has(importedNote.id)
      ? { ...importedNote, id: createId(), title: `${importedNote.title || ''} (مستوردة)` }
      : importedNote;
    noteIds.add(note.id);
    notes.push(note);
  }
  return { notes, folders, settings: current.settings };
}
