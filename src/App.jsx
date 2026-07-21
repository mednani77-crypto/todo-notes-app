import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'todo-notes-app:v1';
const TEXT = {
  appName: 'ملاحظاتي', workspace: 'مساحة هادئة لأفكارك ومهامك', newNote: 'ملاحظة جديدة', editNote: 'تعديل الملاحظة',
  placeholder: 'ابدأ الكتابة هنا...', add: 'حفظ الملاحظة', save: 'حفظ التغييرات', cancel: 'إلغاء', close: 'إغلاق المحرر',
  all: 'الكل', active: 'النشطة', completed: 'المكتملة', total: 'الإجمالي', activeShort: 'نشطة', completedShort: 'مكتملة',
  searchPlaceholder: 'البحث في الملاحظات', searchAria: 'البحث في الملاحظات', filterAria: 'تصفية الملاحظات', listAria: 'قائمة الملاحظات', results: 'ملاحظة ظاهرة',
  noteLabel: 'ملاحظة', completedLabel: 'مكتملة', markActive: 'إرجاع الملاحظة إلى النشطة', markCompleted: 'تعليم الملاحظة كمكتملة',
  edit: 'تعديل', remove: 'حذف', removeConfirm: 'هل تريد حذف هذه الملاحظة؟ لا يمكن التراجع عن ذلك.', exportPdf: 'تصدير PDF', exportNote: 'تصدير الملاحظة إلى PDF', noteActions: 'إجراءات الملاحظة',
  emptyTitle: 'مساحتك جاهزة', emptyBody: 'أضف أول ملاحظة واحتفظ بأفكارك ومهامك في مكان واحد.', noResultsTitle: 'لا توجد نتائج', noResultsBody: 'جرّب عبارة بحث أخرى أو غيّر عامل التصفية.',
  startRecording: 'تحويل الصوت إلى نص', stopRecording: 'إيقاف التسجيل', recording: 'جاري الاستماع… تكلم الآن', voiceReady: 'يمكنك الإملاء بالعربية وسيظهر النص هنا مباشرة.',
  voiceUnsupported: 'التحويل الصوتي غير مدعوم هنا. جرّب Chrome على Android.', voicePermissionDenied: 'اسمح للمتصفح باستخدام الميكروفون ثم حاول مرة أخرى.', voiceError: 'تعذر تحويل الصوت إلى نص. حاول مرة أخرى.', voiceAdded: 'تمت إضافة النص الصوتي.',
  popupBlocked: 'تعذر فتح نافذة التصدير. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.',
};

const FILTERS = [{ key: 'all', label: TEXT.all }, { key: 'active', label: TEXT.active }, { key: 'completed', label: TEXT.completed }];
const ICON_PATHS = {
  search: 'M21 21l-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z', plus: 'M12 5v14M5 12h14', close: 'M18 6 6 18M6 6l12 12', check: 'm5 12 4 4L19 6',
  edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z', trash: 'M3 6h18M8 6V4h8v2m2 0-1 14H7L6 6m4 4v6m4-6v6',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8M8 17h6',
  mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Zm7 10a7 7 0 0 1-14 0m7 7v3m-4 0h8', stop: 'M7 7h10v10H7z',
};

function Icon({ name, size = 20 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICON_PATHS[name]} /></svg>;
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadStoredNotes() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function formatNoteDate(timestamp) {
  const date = new Date(timestamp || Date.now());
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).format(date);
}

function exportNoteAsPdf(note) {
  const exportedAt = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(note.updatedAt || note.createdAt || Date.now()));
  const status = note.completed ? TEXT.completedLabel : TEXT.activeShort;
  const printWindow = window.open('', '_blank');
  if (!printWindow) { window.alert(TEXT.popupBlocked); return; }
  printWindow.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ملاحظاتي - ملاحظة</title><style>*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#25231f;margin:36px;line-height:1.9}.header{border-bottom:2px solid #d99a2b;padding-bottom:14px;margin-bottom:28px}h1{margin:0;color:#25231f;font-size:30px}.meta{margin-top:4px;color:#77736c;font-size:13px}.note{white-space:pre-wrap;font-size:18px}.status{display:inline-block;padding:4px 12px;border-radius:999px;background:#fff4d6;color:#805400;font-weight:bold}@media print{body{margin:20mm}}</style></head><body><div class="header"><h1>ملاحظاتي</h1><div class="meta">${escapeHtml(exportedAt)}</div></div><p class="status">الحالة: ${status}</p><div class="note">${escapeHtml(note.text)}</div></body></html>`);
  printWindow.document.close();
  window.setTimeout(() => { printWindow.focus(); printWindow.print(); }, 250);
}

function NoteCard({ note, onToggle, onEdit, onRemove, onExport }) {
  return (
    <article className={`note-card ${note.completed ? 'is-completed' : ''}`}>
      <div className="note-card-topline">
        <span className="note-kind"><span className="note-kind-dot" />{note.completed ? TEXT.completedLabel : TEXT.noteLabel}</span>
        <button className="complete-button" type="button" onClick={() => onToggle(note.id)} aria-label={note.completed ? TEXT.markActive : TEXT.markCompleted} title={note.completed ? TEXT.markActive : TEXT.markCompleted}>{note.completed && <Icon name="check" size={17} />}</button>
      </div>
      <p className="note-text">{note.text}</p>
      <div className="note-card-footer">
        <time dateTime={new Date(note.updatedAt || note.createdAt).toISOString()}>{formatNoteDate(note.updatedAt || note.createdAt)}</time>
        <div className="note-actions" aria-label={TEXT.noteActions}>
          <button type="button" onClick={() => onExport(note)} aria-label={TEXT.exportNote} title={TEXT.exportPdf}><Icon name="file" /></button>
          <button type="button" onClick={() => onEdit(note)} aria-label={TEXT.edit} title={TEXT.edit}><Icon name="edit" /></button>
          <button type="button" className="danger" onClick={() => onRemove(note.id)} aria-label={TEXT.remove} title={TEXT.remove}><Icon name="trash" /></button>
        </div>
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState(TEXT.voiceReady);
  const recognitionRef = useRef(null);
  const draftBeforeRecordingRef = useRef('');
  const editorRef = useRef(null);

  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); }, [notes]);
  useEffect(() => () => recognitionRef.current?.abort(), []);
  useEffect(() => {
    if (!composerOpen) return undefined;
    document.body.classList.add('modal-open');
    const focusTimer = window.setTimeout(() => editorRef.current?.focus(), 100);
    const handleEscape = (event) => { if (event.key === 'Escape') closeComposer(); };
    window.addEventListener('keydown', handleEscape);
    return () => { window.clearTimeout(focusTimer); window.removeEventListener('keydown', handleEscape); document.body.classList.remove('modal-open'); };
  }, [composerOpen]);

  const stats = useMemo(() => {
    const completed = notes.filter((note) => note.completed).length;
    return { total: notes.length, completed, active: notes.length - completed };
  }, [notes]);
  const visibleNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notes.filter((note) => note.text.toLowerCase().includes(query) && (filter === 'all' || (filter === 'active' && !note.completed) || (filter === 'completed' && note.completed)));
  }, [notes, search, filter]);

  function openNewNote() {
    recognitionRef.current?.abort(); setEditingId(null); setDraft(''); setVoiceMessage(TEXT.voiceReady); setIsListening(false); setComposerOpen(true);
  }
  function closeComposer() {
    recognitionRef.current?.abort(); recognitionRef.current = null; setComposerOpen(false); setEditingId(null); setDraft(''); setIsListening(false); setVoiceMessage(TEXT.voiceReady);
  }
  function handleSubmit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (editingId) setNotes((current) => current.map((note) => note.id === editingId ? { ...note, text, updatedAt: Date.now() } : note));
    else setNotes((current) => [{ id: createId(), text, completed: false, createdAt: Date.now(), updatedAt: Date.now() }, ...current]);
    closeComposer();
  }
  function toggleNote(id) {
    setNotes((current) => current.map((note) => note.id === id ? { ...note, completed: !note.completed, updatedAt: Date.now() } : note));
  }
  function startEditing(note) {
    recognitionRef.current?.abort(); setEditingId(note.id); setDraft(note.text); setVoiceMessage(TEXT.voiceReady); setIsListening(false); setComposerOpen(true);
  }
  function removeNote(id) {
    if (!window.confirm(TEXT.removeConfirm)) return;
    setNotes((current) => current.filter((note) => note.id !== id));
    if (editingId === id) closeComposer();
  }
  function toggleVoiceRecording() {
    if (isListening) { setVoiceMessage(TEXT.voiceReady); recognitionRef.current?.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setVoiceMessage(TEXT.voiceUnsupported); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA'; recognition.continuous = false; recognition.interimResults = true; draftBeforeRecordingRef.current = draft.trim();
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0].transcript;
      const prefix = draftBeforeRecordingRef.current ? `${draftBeforeRecordingRef.current} ` : '';
      setDraft(`${prefix}${transcript}`.trim());
      if (event.results[event.results.length - 1].isFinal) setVoiceMessage(TEXT.voiceAdded);
    };
    recognition.onerror = (event) => { setIsListening(false); setVoiceMessage(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? TEXT.voicePermissionDenied : TEXT.voiceError); };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition; setVoiceMessage(TEXT.recording); setIsListening(true); recognition.start();
  }

  const emptyTitle = notes.length === 0 ? TEXT.emptyTitle : TEXT.noResultsTitle;
  const emptyBody = notes.length === 0 ? TEXT.emptyBody : TEXT.noResultsBody;

  return (
    <main className="app-shell" dir="rtl">
      <header className="app-header">
        <div className="brand-row"><div><h1>{TEXT.appName}</h1><p>{TEXT.workspace}</p></div><button className="desktop-add" type="button" onClick={openNewNote}><Icon name="plus" />{TEXT.newNote}</button></div>
        <label className="search-box"><Icon name="search" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={TEXT.searchPlaceholder} aria-label={TEXT.searchAria} /></label>
        <div className="filter-row" role="group" aria-label={TEXT.filterAria}>{FILTERS.map((item) => <button key={item.key} type="button" className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)}>{item.label}</button>)}</div>
        <div className="overview-row"><p className="results-count"><strong>{visibleNotes.length}</strong> {TEXT.results}</p><div className="compact-stats" aria-label="إحصائيات الملاحظات"><span>{TEXT.total} <strong>{stats.total}</strong></span><span>{TEXT.activeShort} <strong>{stats.active}</strong></span><span>{TEXT.completedShort} <strong>{stats.completed}</strong></span></div></div>
      </header>

      <section className="notes-grid" aria-label={TEXT.listAria}>
        {visibleNotes.length > 0 ? visibleNotes.map((note) => <NoteCard key={note.id} note={note} onToggle={toggleNote} onEdit={startEditing} onRemove={removeNote} onExport={exportNoteAsPdf} />) : (
          <div className="empty-state"><div className="empty-sheet"><span /><span /><span /></div><h2>{emptyTitle}</h2><p>{emptyBody}</p>{notes.length === 0 && <button type="button" onClick={openNewNote}><Icon name="plus" />{TEXT.newNote}</button>}</div>
        )}
      </section>

      <button className="floating-add" type="button" onClick={openNewNote} aria-label={TEXT.newNote}><Icon name="plus" size={26} /></button>

      {composerOpen && <div className="editor-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeComposer(); }}>
        <section className="editor-sheet" role="dialog" aria-modal="true" aria-labelledby="editor-title">
          <header className="editor-header"><div><span>{editingId ? TEXT.editNote : TEXT.newNote}</span><h2 id="editor-title">{TEXT.appName}</h2></div><button className="icon-button" type="button" onClick={closeComposer} aria-label={TEXT.close}><Icon name="close" /></button></header>
          <form onSubmit={handleSubmit}>
            <textarea ref={editorRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={TEXT.placeholder} rows="8" />
            <div className="voice-panel"><button className={`voice-button ${isListening ? 'is-listening' : ''}`} type="button" onClick={toggleVoiceRecording} aria-pressed={isListening}><Icon name={isListening ? 'stop' : 'mic'} />{isListening ? TEXT.stopRecording : TEXT.startRecording}</button><p role="status">{voiceMessage}</p></div>
            <div className="editor-actions"><button className="secondary-button" type="button" onClick={closeComposer}>{TEXT.cancel}</button><button className="primary-button" type="submit" disabled={!draft.trim()}>{editingId ? TEXT.save : TEXT.add}</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}
