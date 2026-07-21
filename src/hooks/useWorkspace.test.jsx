import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../constants.js';
import { useWorkspace } from './useWorkspace.js';

describe('workspace note, folder, and state persistence', () => {
  beforeEach(() => localStorage.clear());

  it('creates, edits, pins, favorites, trashes, restores, and persists a note', async () => {
    const { result } = renderHook(() => useWorkspace());
    let note;
    act(() => { note = result.current.createNote(); });
    act(() => { result.current.saveNote({ ...note, title: 'اختبار', content: '<p>First</p>', plainText: 'First', text: 'First' }); });
    act(() => { result.current.patchNote(note.id, { content: '<p>Edited</p>', plainText: 'Edited', text: 'Edited', pinned: true, favorite: true }); });
    expect(result.current.notes[0]).toMatchObject({ id: note.id, text: 'Edited', pinned: true, favorite: true });
    act(() => { result.current.patchNote(note.id, { trashedAt: 100 }); });
    expect(result.current.notes[0].trashedAt).toBe(100);
    act(() => { result.current.patchNote(note.id, { trashedAt: null }); });
    expect(result.current.notes[0].trashedAt).toBeNull();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.notes))[0].text).toBe('Edited'));
  });

  it('creates, renames, and safely deletes a folder without deleting its notes', () => {
    const { result } = renderHook(() => useWorkspace());
    let folder;
    let note;
    act(() => { folder = result.current.createFolder('مشروع'); });
    act(() => {
      note = result.current.createNote({ folderId: folder.id, title: 'Inside' });
      result.current.saveNote(note);
    });
    act(() => { result.current.renameFolder(folder.id, 'مشروع جديد'); });
    expect(result.current.folders[0].name).toBe('مشروع جديد');
    act(() => { result.current.deleteFolder(folder.id); });
    expect(result.current.folders).toHaveLength(0);
    expect(result.current.notes).toHaveLength(1);
    expect(result.current.notes[0].folderId).toBeNull();
  });

  it('removes a note only after an explicit permanent-delete call', () => {
    const { result } = renderHook(() => useWorkspace());
    let note;
    act(() => { note = result.current.createNote({ title: 'Delete me' }); result.current.saveNote(note); });
    expect(result.current.notes).toHaveLength(1);
    act(() => result.current.removeNote(note.id));
    expect(result.current.notes).toHaveLength(0);
  });
});
