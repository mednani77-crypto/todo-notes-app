import { useCallback, useEffect, useRef, useState } from 'react';
import { STORAGE_KEYS } from '../constants.js';
import {
  createEmptyNote,
  loadWorkspace,
  mergeBackups,
  normalizeNote,
  saveWorkspace,
} from '../lib/storage.js';
import { createId } from '../lib/noteUtils.js';

export function useWorkspace() {
  const [initial] = useState(loadWorkspace);
  const [notes, setNotes] = useState(initial.notes);
  const [folders, setFolders] = useState(initial.folders);
  const [settings, setSettings] = useState(initial.settings);
  const [storageError, setStorageError] = useState(initial.storageError);
  const [isReady] = useState(true);
  const skipPersistenceRef = useRef(Boolean(initial.storageError));

  useEffect(() => {
    if (skipPersistenceRef.current) return;
    try {
      saveWorkspace({ notes, folders, settings });
      queueMicrotask(() => setStorageError((current) => current === 'legacy-corrupt' ? current : null));
    } catch (error) {
      console.warn('Workspace persistence failed without clearing the existing saved data.', error?.name);
      queueMicrotask(() => setStorageError(error?.name === 'QuotaExceededError' ? 'quota' : 'write-failed'));
    }
  }, [notes, folders, settings]);

  const saveNote = useCallback((note) => {
    const normalized = normalizeNote({ ...note, updatedAt: Date.now() });
    setNotes((current) => {
      const exists = current.some((item) => item.id === normalized.id);
      return exists
        ? current.map((item) => item.id === normalized.id ? normalized : item)
        : [normalized, ...current];
    });
    return normalized;
  }, []);

  const createNote = useCallback((overrides) => createEmptyNote(overrides), []);

  const patchNote = useCallback((id, patch) => {
    let updated;
    setNotes((current) => current.map((note) => {
      if (note.id !== id) return note;
      updated = normalizeNote({ ...note, ...patch, updatedAt: Date.now() });
      return updated;
    }));
    return updated;
  }, []);

  const removeNote = useCallback((id) => {
    setNotes((current) => current.filter((note) => note.id !== id));
  }, []);

  const createFolder = useCallback((name) => {
    const folder = { id: createId(), name: String(name).trim().slice(0, 80), createdAt: Date.now() };
    if (!folder.name) return null;
    setFolders((current) => [...current, folder]);
    return folder;
  }, []);

  const renameFolder = useCallback((id, name) => {
    const normalizedName = String(name).trim().slice(0, 80);
    if (!normalizedName) return;
    setFolders((current) => current.map((folder) => folder.id === id ? { ...folder, name: normalizedName } : folder));
  }, []);

  const deleteFolder = useCallback((id) => {
    setFolders((current) => current.filter((folder) => folder.id !== id));
    setNotes((current) => current.map((note) => note.folderId === id
      ? normalizeNote({ ...note, folderId: null, updatedAt: Date.now() })
      : note));
  }, []);

  const applyImport = useCallback((imported, mode) => {
    const current = { notes, folders, settings };
    const next = mode === 'replace' ? imported : mergeBackups(current, imported);
    try {
      window.localStorage.setItem(STORAGE_KEYS.importBackup, JSON.stringify(current));
    } catch { /* replacing is still explicit; in-memory state remains available */ }
    skipPersistenceRef.current = false;
    setNotes(next.notes);
    setFolders(next.folders);
    if (mode === 'replace') setSettings(next.settings);
    setStorageError(null);
  }, [folders, notes, settings]);

  const unlockAfterRecovery = useCallback(() => {
    skipPersistenceRef.current = false;
    setStorageError(null);
  }, []);

  return {
    notes,
    folders,
    settings,
    storageError,
    recoveryRaw: initial.recoveryRaw,
    isReady,
    setSettings,
    saveNote,
    createNote,
    patchNote,
    removeNote,
    createFolder,
    renameFolder,
    deleteFolder,
    applyImport,
    unlockAfterRecovery,
  };
}
