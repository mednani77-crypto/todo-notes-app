import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'todo-notes-app:v1';
const TEXT = {
  "all": "\u0627\u0644\u0643\u0644",
  "active": "\u0627\u0644\u0646\u0634\u0637\u0629",
  "completed": "\u0627\u0644\u0645\u0643\u062a\u0645\u0644\u0629",
  "markActive": "\u0625\u0631\u062c\u0627\u0639 \u0627\u0644\u0645\u0647\u0645\u0629 \u0625\u0644\u0649 \u0627\u0644\u0646\u0634\u0637\u0629",
  "markCompleted": "\u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0645\u0647\u0645\u0629 \u0643\u0645\u0643\u062a\u0645\u0644\u0629",
  "returnActive": "\u0625\u0631\u062c\u0627\u0639 \u0644\u0644\u0646\u0634\u0637\u0629",
  "done": "\u062a\u0645",
  "noteActions": "\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0629",
  "editNote": "\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0629",
  "removeNote": "\u062d\u0630\u0641 \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0629",
  "edit": "\u062a\u0639\u062f\u064a\u0644",
  "remove": "\u062d\u0630\u0641",
  "dailyBoard": "\u0644\u0648\u062d\u0629 \u0645\u0647\u0627\u0645 \u064a\u0648\u0645\u064a\u0629",
  "appName": "\u0645\u0644\u0627\u062d\u0638\u0627\u062a\u064a",
  "tagline": "\u0627\u0643\u062a\u0628 \u0645\u0647\u0627\u0645\u0643 \u0648\u0645\u0644\u0627\u062d\u0638\u0627\u062a\u0643 \u0628\u0633\u0631\u0639\u0629\u060c \u0648\u0639\u062f\u0651\u0644\u0647\u0627\u060c \u0648\u062a\u0627\u0628\u0639 \u0625\u0646\u062c\u0627\u0632\u0643 \u0645\u0646 \u0627\u0644\u0647\u0627\u062a\u0641.",
  "localSaveEnabled": "\u0627\u0644\u062d\u0641\u0638 \u0627\u0644\u0645\u062d\u0644\u064a \u0645\u0641\u0639\u0644",
  "autoSave": "\u062d\u0641\u0638 \u062a\u0644\u0642\u0627\u0626\u064a",
  "addEditAria": "\u0625\u0636\u0627\u0641\u0629 \u0623\u0648 \u062a\u0639\u062f\u064a\u0644 \u0645\u0644\u0627\u062d\u0638\u0629",
  "newNote": "\u0645\u0644\u0627\u062d\u0638\u0629 \u062c\u062f\u064a\u062f\u0629",
  "placeholder": "\u0627\u0643\u062a\u0628 \u0645\u0647\u0645\u0629 \u0623\u0648 \u0645\u0644\u0627\u062d\u0638\u0629...",
  "save": "\u062d\u0641\u0638",
  "add": "\u0625\u0636\u0627\u0641\u0629",
  "cancelEdit": "\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062a\u0639\u062f\u064a\u0644",
  "statsAria": "\u0625\u062d\u0635\u0627\u0626\u064a\u0627\u062a \u0627\u0644\u0645\u0647\u0627\u0645",
  "total": "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a",
  "completedShort": "\u0645\u0643\u062a\u0645\u0644\u0629",
  "activeShort": "\u0646\u0634\u0637\u0629",
  "searchFilterAria": "\u0627\u0644\u0628\u062d\u062b \u0648\u062a\u0635\u0641\u064a\u0629 \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a",
  "searchPlaceholder": "\u0627\u0628\u062d\u062b \u0641\u064a \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a...",
  "searchAria": "\u0627\u0644\u0628\u062d\u062b \u0641\u064a \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a",
  "filterAria": "\u062a\u0635\u0641\u064a\u0629 \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a",
  "listAria": "\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a",
  "emptyTitle": "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0644\u0627\u062d\u0638\u0627\u062a",
  "emptyBody": "\u0623\u0636\u0641 \u0645\u0644\u0627\u062d\u0638\u0629 \u062c\u062f\u064a\u062f\u0629 \u0623\u0648 \u063a\u064a\u0651\u0631 \u0627\u0644\u0628\u062d\u062b \u0648\u0627\u0644\u062a\u0635\u0641\u064a\u0629."
};

const FILTERS = [
  { key: 'all', label: TEXT.all },
  { key: 'active', label: TEXT.active },
  { key: 'completed', label: TEXT.completed },
];

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadStoredNotes() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function NoteCard({ note, onToggle, onEdit, onRemove }) {
  return (
    <article className={`note-card ${note.completed ? 'is-completed' : ''}`}>
      <button
        className="complete-button"
        type="button"
        onClick={() => onToggle(note.id)}
        aria-label={note.completed ? TEXT.markActive : TEXT.markCompleted}
        title={note.completed ? TEXT.returnActive : TEXT.done}
      >
        {note.completed ? '\u2713' : ''}
      </button>
      <p className="note-text">{note.text}</p>
      <div className="note-actions" aria-label={TEXT.noteActions}>
        <button type="button" onClick={() => onEdit(note)} aria-label={TEXT.editNote}>
          {TEXT.edit}
        </button>
        <button type="button" className="danger" onClick={() => onRemove(note.id)} aria-label={TEXT.removeNote}>
          {TEXT.remove}
        </button>
      </div>
    </article>
  );
}

export default function App() {
  const [notes, setNotes] = useState(loadStoredNotes);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  const stats = useMemo(() => {
    const completed = notes.filter((note) => note.completed).length;
    return { total: notes.length, completed, active: notes.length - completed };
  }, [notes]);

  const visibleNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notes.filter((note) => {
      const matchesSearch = note.text.toLowerCase().includes(query);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && !note.completed) ||
        (filter === 'completed' && note.completed);
      return matchesSearch && matchesFilter;
    });
  }, [notes, search, filter]);

  function handleSubmit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    if (editingId) {
      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.id === editingId ? { ...note, text, updatedAt: Date.now() } : note,
        ),
      );
      setEditingId(null);
    } else {
      setNotes((currentNotes) => [
        { id: createId(), text, completed: false, createdAt: Date.now(), updatedAt: Date.now() },
        ...currentNotes,
      ]);
    }

    setDraft('');
  }

  function toggleNote(id) {
    setNotes((currentNotes) =>
      currentNotes.map((note) =>
        note.id === id ? { ...note, completed: !note.completed, updatedAt: Date.now() } : note,
      ),
    );
  }

  function startEditing(note) {
    setEditingId(note.id);
    setDraft(note.text);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEditing() {
    setEditingId(null);
    setDraft('');
  }

  function removeNote(id) {
    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id));
    if (editingId === id) cancelEditing();
  }

  return (
    <main className="app-shell" dir="rtl">
      <section className="hero-card" aria-labelledby="app-title">
        <div className="hero-topline">{TEXT.dailyBoard}</div>
        <div className="hero-heading-row">
          <div>
            <h1 id="app-title">{TEXT.appName}</h1>
            <p>{TEXT.tagline}</p>
          </div>
          <div className="hero-badge" aria-label={TEXT.localSaveEnabled}>
            {TEXT.autoSave}
          </div>
        </div>
      </section>

      <section className="panel" aria-label={TEXT.addEditAria}>
        <form className="note-form" onSubmit={handleSubmit}>
          <label htmlFor="note-input">{editingId ? TEXT.editNote : TEXT.newNote}</label>
          <div className="add-row">
            <input
              id="note-input"
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={TEXT.placeholder}
              autoComplete="off"
            />
            <button type="submit">{editingId ? TEXT.save : TEXT.add}</button>
          </div>
          {editingId && (
            <button className="cancel-edit" type="button" onClick={cancelEditing}>
              {TEXT.cancelEdit}
            </button>
          )}
        </form>
      </section>

      <section className="stats-grid" aria-label={TEXT.statsAria}>
        <div className="stat-card"><span>{TEXT.total}</span><strong>{stats.total}</strong></div>
        <div className="stat-card"><span>{TEXT.completedShort}</span><strong>{stats.completed}</strong></div>
        <div className="stat-card"><span>{TEXT.activeShort}</span><strong>{stats.active}</strong></div>
      </section>

      <section className="panel controls-panel" aria-label={TEXT.searchFilterAria}>
        <input
          className="search-input"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={TEXT.searchPlaceholder}
          aria-label={TEXT.searchAria}
        />
        <div className="filter-row" role="group" aria-label={TEXT.filterAria}>
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={filter === item.key ? 'active' : ''}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="notes-list" aria-label={TEXT.listAria}>
        {visibleNotes.length > 0 ? (
          visibleNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onToggle={toggleNote}
              onEdit={startEditing}
              onRemove={removeNote}
            />
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">{'\u2713'}</div>
            <h2>{TEXT.emptyTitle}</h2>
            <p>{TEXT.emptyBody}</p>
          </div>
        )}
      </section>
    </main>
  );
}
