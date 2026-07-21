import { describe, expect, it } from 'vitest';
import {
  checklistProgress,
  detectTextDirection,
  highlightParts,
  noteMatchesSearch,
  sortNotes,
} from './noteUtils.js';

describe('note searching, sorting, and RTL behavior', () => {
  const note = { title: 'خطة المشروع', plainText: 'Meet the team', text: 'Meet the team', tags: ['عمل'], updatedAt: 20, createdAt: 10 };

  it('searches Arabic, case-insensitive English, tags, and folder names', () => {
    expect(noteMatchesSearch(note, 'المشروع')).toBe(true);
    expect(noteMatchesSearch(note, 'MEET')).toBe(true);
    expect(noteMatchesSearch(note, 'عمل')).toBe(true);
    expect(noteMatchesSearch(note, 'دراسة', 'دراسة')).toBe(true);
    expect(noteMatchesSearch(note, 'missing')).toBe(false);
  });

  it('detects the first strong text direction for mixed content', () => {
    expect(detectTextDirection('مرحبا hello')).toBe('rtl');
    expect(detectTextDirection('Hello مرحبا')).toBe('ltr');
    expect(detectTextDirection('123 مرحبا')).toBe('rtl');
  });

  it('sorts by modified, created, title, and pinned-first', () => {
    const notes = [
      { ...note, id: 'a', title: 'ب', updatedAt: 1, createdAt: 3, pinned: false },
      { ...note, id: 'b', title: 'أ', updatedAt: 2, createdAt: 2, pinned: true },
    ];
    expect(sortNotes(notes, 'updated')[0].id).toBe('b');
    expect(sortNotes(notes, 'created')[0].id).toBe('a');
    expect(sortNotes(notes, 'title')[0].id).toBe('b');
    expect(sortNotes(notes, 'pinned')[0].id).toBe('b');
  });

  it('computes persisted checklist progress and highlights query text', () => {
    const progress = checklistProgress('<ul data-type="taskList"><li data-type="taskItem" data-checked="true">one</li><li data-type="taskItem" data-checked="false">two</li></ul>');
    expect(progress).toEqual({ complete: 1, total: 2 });
    expect(highlightParts('مرحبا بالعالم', 'بالعالم').some((part) => part.match)).toBe(true);
  });
});
