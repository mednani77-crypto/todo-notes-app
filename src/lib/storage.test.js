import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, STORAGE_KEYS } from '../constants.js';
import {
  buildBackup,
  loadWorkspace,
  mergeBackups,
  normalizeNote,
  saveWorkspace,
  validateBackup,
} from './storage.js';

describe('legacy data migration', () => {
  beforeEach(() => localStorage.clear());

  it('migrates the deployed v1 note shape without changing the storage key or note text', () => {
    const legacy = [{ id: 'legacy-1', text: 'عنوان عربي\nEnglish detail', completed: true, createdAt: 10, updatedAt: 20 }];
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(legacy));

    const workspace = loadWorkspace(localStorage);

    expect(workspace.notes).toHaveLength(1);
    expect(workspace.notes[0]).toMatchObject({ id: 'legacy-1', text: 'عنوان عربي\nEnglish detail', completed: true, schemaVersion: SCHEMA_VERSION });
    expect(workspace.notes[0].content).toContain('عنوان عربي');
    expect(localStorage.getItem(STORAGE_KEYS.legacyBackup)).toBe(JSON.stringify(legacy));
    expect(localStorage.getItem(STORAGE_KEYS.schema)).toBe(String(SCHEMA_VERSION));

    saveWorkspace(workspace, localStorage);
    expect(JSON.parse(localStorage.getItem('todo-notes-app:v1'))[0].id).toBe('legacy-1');
  });

  it('is idempotent and does not replace the original pre-migration backup', () => {
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify([{ id: 'a', text: 'first' }]));
    const first = loadWorkspace(localStorage);
    saveWorkspace(first, localStorage);
    localStorage.setItem(STORAGE_KEYS.legacyBackup, 'protected-backup');
    const second = loadWorkspace(localStorage);
    expect(second.notes[0].id).toBe('a');
    expect(localStorage.getItem(STORAGE_KEYS.legacyBackup)).toBe('protected-backup');
  });

  it('preserves malformed raw data and blocks automatic persistence', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEYS.notes, '{not-json');
    const workspace = loadWorkspace(localStorage);
    expect(workspace.storageError).toBe('legacy-corrupt');
    expect(workspace.recoveryRaw).toBe('{not-json');
    expect(localStorage.getItem(STORAGE_KEYS.recovery)).toBe('{not-json');
    expect(localStorage.getItem(STORAGE_KEYS.notes)).toBe('{not-json');
  });

  it('sanitizes rich text and normalizes organization fields', () => {
    const note = normalizeNote({
      id: 'unsafe',
      content: '<p onclick="steal()">safe</p><script>alert(1)</script>',
      tags: [' عمل ', 'عمل', 'English'],
      color: 'unknown',
    });
    expect(note.content).toBe('<p>safe</p>');
    expect(note.tags).toEqual(['عمل', 'English']);
    expect(note.color).toBe('sand');
  });
});

describe('backup import safety', () => {
  it('creates a versioned backup and validates it', () => {
    const backup = buildBackup({ notes: [normalizeNote({ id: '1', text: 'one' })], folders: [], settings: {} });
    expect(backup).toMatchObject({ type: 'todo-notes-app-backup', version: SCHEMA_VERSION });
    expect(validateBackup(backup).notes[0].text).toBe('one');
  });

  it('rejects malformed imports before they can change current data', () => {
    expect(() => validateBackup({ notes: [] })).toThrow(/نسخة احتياطية/);
    expect(() => validateBackup({ type: 'todo-notes-app-backup', version: 3, notes: 'bad', folders: [] })).toThrow(/غير مكتملة/);
  });

  it('merges duplicate note ids by assigning a safe new id', () => {
    const original = normalizeNote({ id: 'same', text: 'current' });
    const imported = normalizeNote({ id: 'same', text: 'imported' });
    const merged = mergeBackups(
      { notes: [original], folders: [], settings: {} },
      { notes: [imported], folders: [], settings: {} },
    );
    expect(merged.notes).toHaveLength(2);
    expect(new Set(merged.notes.map((note) => note.id)).size).toBe(2);
  });
});
