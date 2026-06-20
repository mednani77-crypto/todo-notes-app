import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'todo-notes-app:v1';
const FILTERS = ['All', 'Active', 'Completed'];

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

function NoteCard({ note, onToggle, onEdit, onDelete }) {
  return (
    <article className={`note-card ${note.completed ? 'is-completed' : ''}`}>
      <button
        className="complete-button"
        type="button"
        onClick={() => onToggle(note.id)}
        aria-label={note.completed ? 'Mark as active' : 'Mark as completed'}
        title={note.completed ? 'Mark active' : 'Mark done'}
      >
        {note.completed ? '✓' : ''}
      </button>

      <p className="note-text">{note.text}</p>

      <div className="note-actions" aria-label="Note actions">
        <button type="button" onClick={() => onEdit(note)} aria-label="Edit note">
          Edit
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => onDelete(note.id)}
          aria-label="Delete note"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

export default function App() {
  const [notes, setNotes] = useState(loadStoredNotes);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  const stats = useMemo(() => {
    const completed = notes.filter((note) => note.completed).length;
    return {
      total: notes.length,
      completed,
      active: notes.length - completed,
    };
  }, [notes]);

  const visibleNotes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return notes.filter((note) => {
      const matchesSearch = note.text.toLowerCase().includes(query);
      const matchesFilter =
        filter === 'All' ||
        (filter === 'Active' && !note.completed) ||
        (filter === 'Completed' && note.completed);

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
        {
          id: createId(),
          text,
          completed: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        ...currentNotes,
      ]);
    }

    setDraft('');
  }

  function toggleNote(id) {
    setNotes((currentNotes) =>
      currentNotes.map((note) =>
        note.id === id
          ? { ...note, completed: !note.completed, updatedAt: Date.now() }
          : note,
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

  function deleteNote(id) {
    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id));
    if (editingId === id) {
      cancelEditing();
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-card" aria-labelledby="app-title">
        <div className="hero-topline">Mobile task dashboard</div>
        <div className="hero-heading-row">
          <div>
            <h1 id="app-title">To-Do Notes</h1>
            <p>Capture tasks, edit notes, and track progress on your phone.</p>
          </div>
          <div className="hero-badge" aria-label="Local storage enabled">
            Saved locally
          </div>
        </div>
      </section>

      <section className="panel" aria-label="Create or edit a note">
        <form className="note-form" onSubmit={handleSubmit}>
          <label htmlFor="note-input">{editingId ? 'Edit note' : 'New note'}</label>
          <div className="add-row">
            <input
              id="note-input"
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a task or note..."
              autoComplete="off"
            />
            <button type="submit">{editingId ? 'Save' : 'Add'}</button>
          </div>
          {editingId && (
            <button className="cancel-edit" type="button" onClick={cancelEditing}>
              Cancel editing
            </button>
          )}
        </form>
      </section>

      <section className="stats-grid" aria-label="Task statistics">
        <div className="stat-card">
          <span>Total</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="stat-card">
          <span>Completed</span>
          <strong>{stats.completed}</strong>
        </div>
        <div className="stat-card">
          <span>Active</span>
          <strong>{stats.active}</strong>
        </div>
      </section>

      <section className="panel controls-panel" aria-label="Search and filter notes">
        <input
          className="search-input"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search notes..."
        />
        <div className="filter-row" role="group" aria-label="Filter notes">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? 'active' : ''}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="notes-list" aria-label="Notes list">
        {visibleNotes.length > 0 ? (
          visibleNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onToggle={toggleNote}
              onEdit={startEditing}
              onDelete={deleteNote}
            />
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <h2>No notes found</h2>
            <p>Add a new note or change your search/filter.</p>
          </div>
        )}
      </section>
    </main>
  );
}
