import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'todo-notes-app:v1';
const TEXT = {
  all: 'الكل',
  active: 'النشطة',
  completed: 'المكتملة',
  markActive: 'إرجاع المهمة إلى النشطة',
  markCompleted: 'تعليم المهمة كمكتملة',
  returnActive: 'إرجاع للنشطة',
  done: 'تم',
  noteActions: 'إجراءات الملاحظة',
  editNote: 'تعديل الملاحظة',
  removeNote: 'حذف الملاحظة',
  exportNote: 'تصدير الملاحظة إلى PDF',
  edit: 'تعديل',
  remove: 'حذف',
  exportPdf: 'تصدير PDF',
  dailyBoard: 'لوحة مهام يومية',
  appName: 'ملاحظاتي',
  tagline: 'اكتب مهامك وملاحظاتك بسرعة، وعدّلها، وتابع إنجازك من الهاتف.',
  localSaveEnabled: 'الحفظ المحلي مفعل',
  autoSave: 'حفظ تلقائي',
  addEditAria: 'إضافة أو تعديل ملاحظة',
  newNote: 'ملاحظة جديدة',
  placeholder: 'اكتب مهمة أو ملاحظة...',
  save: 'حفظ',
  add: 'إضافة',
  cancelEdit: 'إلغاء التعديل',
  startRecording: 'تسجيل صوتي',
  stopRecording: 'إيقاف التسجيل',
  recording: 'جاري الاستماع… تكلم الآن',
  voiceReady: 'اضغط زر التسجيل ثم ابدأ الكلام.',
  voiceUnsupported: 'التحويل الصوتي غير مدعوم في هذا المتصفح. جرّب Chrome على Android.',
  voicePermissionDenied: 'يلزم السماح للمتصفح باستخدام الميكروفون.',
  voiceError: 'تعذر تحويل الصوت إلى نص. حاول مرة أخرى.',
  voiceAdded: 'تمت إضافة النص الصوتي إلى الملاحظة.',
  statsAria: 'إحصائيات المهام',
  total: 'الإجمالي',
  completedShort: 'مكتملة',
  activeShort: 'نشطة',
  searchFilterAria: 'البحث وتصفية الملاحظات',
  searchPlaceholder: 'ابحث في الملاحظات...',
  searchAria: 'البحث في الملاحظات',
  filterAria: 'تصفية الملاحظات',
  listAria: 'قائمة الملاحظات',
  emptyTitle: 'لا توجد ملاحظات',
  emptyBody: 'أضف ملاحظة جديدة أو غيّر البحث والتصفية.',
};

const FILTERS = [
  { key: 'all', label: TEXT.all },
  { key: 'active', label: TEXT.active },
  { key: 'completed', label: TEXT.completed },
];

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
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

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function exportNoteAsPdf(note) {
  const exportedAt = new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(note.updatedAt || note.createdAt || Date.now()));
  const status = note.completed ? 'مكتملة' : 'نشطة';
  const printWindow = window.open('', '_blank');

  if (!printWindow) return;

  printWindow.document.write(`<!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ملاحظاتي - ملاحظة</title>
        <style>
          body { font-family: Tahoma, Arial, sans-serif; direction: rtl; color: #172033; margin: 36px; line-height: 1.9; }
          .header { border-bottom: 3px solid #2563eb; padding-bottom: 14px; margin-bottom: 24px; }
          h1 { margin: 0; color: #1d4ed8; font-size: 30px; }
          .meta { color: #667085; font-size: 14px; }
          .note { white-space: pre-wrap; font-size: 18px; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-weight: bold; }
          @media print { body { margin: 20mm; } }
        </style>
      </head>
      <body>
        <div class="header"><h1>ملاحظاتي</h1><div class="meta">تم التصدير: ${escapeHtml(exportedAt)}</div></div>
        <p class="status">الحالة: ${status}</p>
        <div class="note">${escapeHtml(note.text)}</div>
      </body>
    </html>`);
  printWindow.document.close();
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
}

function NoteCard({ note, onToggle, onEdit, onRemove, onExport }) {
  return (
    <article className={`note-card ${note.completed ? 'is-completed' : ''}`}>
      <button className="complete-button" type="button" onClick={() => onToggle(note.id)} aria-label={note.completed ? TEXT.markActive : TEXT.markCompleted} title={note.completed ? TEXT.returnActive : TEXT.done}>
        {note.completed ? '✓' : ''}
      </button>
      <p className="note-text">{note.text}</p>
      <div className="note-actions" aria-label={TEXT.noteActions}>
        <button type="button" className="export-button" onClick={() => onExport(note)} aria-label={TEXT.exportNote}>{TEXT.exportPdf}</button>
        <button type="button" onClick={() => onEdit(note)} aria-label={TEXT.editNote}>{TEXT.edit}</button>
        <button type="button" className="danger" onClick={() => onRemove(note.id)} aria-label={TEXT.removeNote}>{TEXT.remove}</button>
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
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState(TEXT.voiceReady);
  const recognitionRef = useRef(null);
  const draftBeforeRecordingRef = useRef('');

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const stats = useMemo(() => {
    const completed = notes.filter((note) => note.completed).length;
    return { total: notes.length, completed, active: notes.length - completed };
  }, [notes]);

  const visibleNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notes.filter((note) => {
      const matchesSearch = note.text.toLowerCase().includes(query);
      const matchesFilter = filter === 'all' || (filter === 'active' && !note.completed) || (filter === 'completed' && note.completed);
      return matchesSearch && matchesFilter;
    });
  }, [notes, search, filter]);

  function handleSubmit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    if (editingId) {
      setNotes((currentNotes) => currentNotes.map((note) => (note.id === editingId ? { ...note, text, updatedAt: Date.now() } : note)));
      setEditingId(null);
    } else {
      setNotes((currentNotes) => [{ id: createId(), text, completed: false, createdAt: Date.now(), updatedAt: Date.now() }, ...currentNotes]);
    }
    setDraft('');
    setVoiceMessage(TEXT.voiceReady);
  }

  function toggleNote(id) {
    setNotes((currentNotes) => currentNotes.map((note) => (note.id === id ? { ...note, completed: !note.completed, updatedAt: Date.now() } : note)));
  }

  function startEditing(note) {
    setEditingId(note.id);
    setDraft(note.text);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEditing() {
    setEditingId(null);
    setDraft('');
    setVoiceMessage(TEXT.voiceReady);
  }

  function removeNote(id) {
    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== id));
    if (editingId === id) cancelEditing();
  }

  function toggleVoiceRecording() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceMessage(TEXT.voiceUnsupported);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = false;
    recognition.interimResults = true;
    draftBeforeRecordingRef.current = draft.trim();
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0].transcript;
      const prefix = draftBeforeRecordingRef.current ? `${draftBeforeRecordingRef.current} ` : '';
      setDraft(`${prefix}${transcript}`.trim());
      if (event.results[event.results.length - 1].isFinal) setVoiceMessage(TEXT.voiceAdded);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      setVoiceMessage(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? TEXT.voicePermissionDenied : TEXT.voiceError);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setVoiceMessage(TEXT.recording);
    setIsListening(true);
    recognition.start();
  }

  return (
    <main className="app-shell" dir="rtl">
      <section className="hero-card" aria-labelledby="app-title">
        <div className="hero-topline">{TEXT.dailyBoard}</div>
        <div className="hero-heading-row"><div><h1 id="app-title">{TEXT.appName}</h1><p>{TEXT.tagline}</p></div><div className="hero-badge" aria-label={TEXT.localSaveEnabled}>{TEXT.autoSave}</div></div>
      </section>

      <section className="panel" aria-label={TEXT.addEditAria}>
        <form className="note-form" onSubmit={handleSubmit}>
          <label htmlFor="note-input">{editingId ? TEXT.editNote : TEXT.newNote}</label>
          <div className="add-row"><input id="note-input" type="text" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={TEXT.placeholder} autoComplete="off" /><button type="submit">{editingId ? TEXT.save : TEXT.add}</button></div>
          <div className="voice-row">
            <button className={`voice-button ${isListening ? 'is-listening' : ''}`} type="button" onClick={toggleVoiceRecording} aria-pressed={isListening}>
              <span aria-hidden="true">{isListening ? '■' : '🎙️'}</span>{isListening ? TEXT.stopRecording : TEXT.startRecording}
            </button>
            <p className="voice-status" role="status">{voiceMessage}</p>
          </div>
          {editingId && <button className="cancel-edit" type="button" onClick={cancelEditing}>{TEXT.cancelEdit}</button>}
        </form>
      </section>

      <section className="stats-grid" aria-label={TEXT.statsAria}>
        <div className="stat-card"><span>{TEXT.total}</span><strong>{stats.total}</strong></div><div className="stat-card"><span>{TEXT.completedShort}</span><strong>{stats.completed}</strong></div><div className="stat-card"><span>{TEXT.activeShort}</span><strong>{stats.active}</strong></div>
      </section>

      <section className="panel controls-panel" aria-label={TEXT.searchFilterAria}>
        <input className="search-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={TEXT.searchPlaceholder} aria-label={TEXT.searchAria} />
        <div className="filter-row" role="group" aria-label={TEXT.filterAria}>{FILTERS.map((item) => <button key={item.key} type="button" className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)}>{item.label}</button>)}</div>
      </section>

      <section className="notes-list" aria-label={TEXT.listAria}>
        {visibleNotes.length > 0 ? visibleNotes.map((note) => <NoteCard key={note.id} note={note} onToggle={toggleNote} onEdit={startEditing} onRemove={removeNote} onExport={exportNoteAsPdf} />) : <div className="empty-state"><div className="empty-icon">✓</div><h2>{TEXT.emptyTitle}</h2><p>{TEXT.emptyBody}</p></div>}
      </section>
    </main>
  );
}
