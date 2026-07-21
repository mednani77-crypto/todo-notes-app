import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  ChevronDown,
  FilePlus2,
  Filter,
  Grid2X2,
  List,
  Moon,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  WifiOff,
  X,
} from 'lucide-react';
import { NOTE_COLORS, STORAGE_KEYS } from './constants.js';
import { useWorkspace } from './hooks/useWorkspace.js';
import { deleteMedia } from './lib/mediaDb.js';
import {
  checklistProgress,
  createId,
  noteMatchesSearch,
  sortNotes,
} from './lib/noteUtils.js';
import { downloadText, safeFilename } from './lib/exporters.js';
import { normalizeNote } from './lib/storage.js';
import NoteCard from './components/NoteCard.jsx';
import PdfExportDialog from './components/PdfExportDialog.jsx';
import { BottomNavigation, Sidebar } from './components/Navigation.jsx';
import { FoldersPanel, TagsPanel } from './components/OrganizationPanels.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import Modal from './components/Modal.jsx';

const NoteEditor = lazy(() => import('./components/NoteEditor.jsx'));

const VIEW_TITLES = {
  all: ['ملاحظاتي', 'كل أفكارك، مرتبة وقريبة منك'],
  pinned: ['المثبتة', 'الملاحظات التي تحتاجها دائماً'],
  favorites: ['المفضلة', 'الأفكار الأقرب إليك'],
  folders: ['المجلدات', 'نظّم عملك حسب السياق'],
  tags: ['الوسوم', 'اعثر على الأفكار عبر أكثر من سياق'],
  archive: ['الأرشيف', 'ملاحظات محفوظة بعيداً عن مساحة العمل'],
  trash: ['سلة المحذوفات', 'استعد ملاحظاتك أو احذفها نهائياً'],
  settings: ['الإعدادات', 'خصص تجربتك وبياناتك'],
};

function readRecentSearches() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEYS.recentSearches) || '[]');
    return Array.isArray(value) ? value.slice(0, 6) : [];
  } catch { return []; }
}

function EmptyState({ view, hasQuery, onCreate, onReset }) {
  const copy = hasQuery
    ? ['لا توجد نتائج', 'جرّب كلمة أخرى أو امسح بعض عوامل التصفية.']
    : view === 'trash'
      ? ['السلة فارغة', 'لن تظهر هنا إلا الملاحظات التي تنقلها إلى السلة.']
      : view === 'archive'
        ? ['لا توجد ملاحظات مؤرشفة', 'استخدم الأرشيف لإبعاد الملاحظات المكتملة دون حذفها.']
        : ['مساحتك جاهزة', 'اكتب فكرتك الأولى، وسيتولى الحفظ التلقائي الباقي.'];
  return (
    <div className="empty-state">
      <div className="empty-illustration" aria-hidden="true"><span /><span /><span /></div>
      <h2>{copy[0]}</h2><p>{copy[1]}</p>
      {hasQuery ? <button type="button" className="secondary-button" onClick={onReset}><X /> مسح البحث والتصفية</button> : !['trash', 'archive'].includes(view) && <button type="button" className="primary-button" onClick={onCreate}><Plus /> ملاحظة جديدة</button>}
    </div>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(timer);
  }, [onClose, toast]);
  if (!toast) return null;
  return <div className="toast" role="status"><span>{toast.message}</span>{toast.undo && <button type="button" onClick={() => { toast.undo(); onClose(); }}>تراجع</button>}<button type="button" className="icon-only" onClick={onClose} aria-label="إغلاق الإشعار"><X /></button></div>;
}

export default function App() {
  const workspace = useWorkspace();
  const [currentView, setCurrentView] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [recentSearches, setRecentSearches] = useState(readRecentSearches);
  const [searchFocused, setSearchFocused] = useState(false);
  const [viewMode, setViewMode] = useState(workspace.settings.defaultView);
  const [sort, setSort] = useState(workspace.settings.sort);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ folder: '', tag: '', color: '', checklists: false, attachments: false });
  const [editorNote, setEditorNote] = useState(null);
  const [pdfNote, setPdfNote] = useState(null);
  const [toast, setToast] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [updateRegistration, setUpdateRegistration] = useState(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const dark = workspace.settings.theme === 'dark' || (workspace.settings.theme === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.documentElement.dataset.fontSize = workspace.settings.fontSize;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171a18' : '#f6f4ee');
    };
    applyTheme();
    media.addEventListener?.('change', applyTheme);
    return () => media.removeEventListener?.('change', applyTheme);
  }, [workspace.settings.fontSize, workspace.settings.theme]);

  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    return () => { window.removeEventListener('online', markOnline); window.removeEventListener('offline', markOffline); };
  }, []);

  useEffect(() => {
    const handleUpdate = (event) => setUpdateRegistration(event.detail.registration);
    window.addEventListener('notes-app-update', handleUpdate);
    return () => window.removeEventListener('notes-app-update', handleUpdate);
  }, []);

  const foldersById = useMemo(() => new Map(workspace.folders.map((folder) => [folder.id, folder])), [workspace.folders]);
  const allTags = useMemo(() => [...new Set(workspace.notes.flatMap((note) => note.tags || []))].sort((a, b) => a.localeCompare(b, 'ar')), [workspace.notes]);
  const counts = useMemo(() => ({
    all: workspace.notes.filter((note) => !note.trashedAt && !note.archived).length,
    pinned: workspace.notes.filter((note) => note.pinned && !note.trashedAt && !note.archived).length,
    favorites: workspace.notes.filter((note) => note.favorite && !note.trashedAt && !note.archived).length,
    archive: workspace.notes.filter((note) => note.archived && !note.trashedAt).length,
    trash: workspace.notes.filter((note) => note.trashedAt).length,
  }), [workspace.notes]);

  const visibleNotes = useMemo(() => {
    let notes = workspace.notes.filter((note) => {
      if (currentView === 'trash') return Boolean(note.trashedAt);
      if (note.trashedAt) return false;
      if (currentView === 'archive') return note.archived;
      if (note.archived) return false;
      if (currentView === 'pinned') return note.pinned;
      if (currentView === 'favorites') return note.favorite;
      return true;
    });
    notes = notes.filter((note) => {
      const folder = foldersById.get(note.folderId)?.name || '';
      if (!noteMatchesSearch(note, debouncedSearch, folder)) return false;
      if (filters.folder && note.folderId !== filters.folder) return false;
      if (filters.tag && !note.tags.includes(filters.tag)) return false;
      if (filters.color && note.color !== filters.color) return false;
      if (filters.checklists && checklistProgress(note.content).total === 0) return false;
      if (filters.attachments && !note.attachments?.length) return false;
      return true;
    });
    return sortNotes(notes, sort);
  }, [currentView, debouncedSearch, filters, foldersById, sort, workspace.notes]);

  const pinnedNotes = currentView === 'all' ? visibleNotes.filter((note) => note.pinned) : [];
  const recentNotes = currentView === 'all' ? visibleNotes.filter((note) => !note.pinned) : visibleNotes;
  const filterCount = [filters.folder, filters.tag, filters.color, filters.checklists, filters.attachments].filter(Boolean).length;
  const title = VIEW_TITLES[currentView] || VIEW_TITLES.all;
  const isDark = workspace.settings.theme === 'dark'
    || (workspace.settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  function showToast(message, undo) {
    setToast({ message, undo });
  }

  function navigate(view) {
    setCurrentView(view);
    setFilters((current) => ({ ...current, folder: '', tag: '' }));
    setFiltersOpen(false);
  }

  function createNote() {
    setEditorNote(workspace.createNote({ folderId: filters.folder || null, tags: filters.tag ? [filters.tag] : [] }));
  }

  function patchNote(note, patch) {
    workspace.patchNote(note.id, patch);
  }

  function archiveNote(note) {
    const previous = note.archived;
    workspace.patchNote(note.id, { archived: !previous });
    showToast(previous ? 'أُعيدت الملاحظة إلى مساحة العمل.' : 'نُقلت الملاحظة إلى الأرشيف.', () => workspace.patchNote(note.id, { archived: previous }));
  }

  function trashNote(note) {
    const previous = note.trashedAt;
    workspace.patchNote(note.id, { trashedAt: Date.now() });
    showToast('نُقلت الملاحظة إلى سلة المحذوفات.', () => workspace.patchNote(note.id, { trashedAt: previous }));
  }

  function restoreNote(note) {
    workspace.patchNote(note.id, { trashedAt: null });
    showToast('تمت استعادة الملاحظة.', () => workspace.patchNote(note.id, { trashedAt: note.trashedAt }));
  }

  function requestPermanentDelete(note) {
    if (workspace.settings.confirmPermanentDelete) setDeleteConfirmation(note);
    else permanentlyDelete(note);
  }

  async function permanentlyDelete(note) {
    await Promise.all((note.attachments || []).map((attachment) => deleteMedia(attachment.id).catch(() => {})));
    workspace.removeNote(note.id);
    setDeleteConfirmation(null);
    showToast('حُذفت الملاحظة نهائياً.');
  }

  function duplicateNote(note) {
    const duplicate = normalizeNote({
      ...note,
      id: createId(),
      title: `${note.title || 'ملاحظة'} — نسخة`,
      pinned: false,
      archived: false,
      trashedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attachments: [],
    });
    workspace.saveNote(duplicate);
    showToast('تم إنشاء نسخة دون تكرار ملفات المرفقات.');
  }

  function resetSearchAndFilters() {
    setSearch('');
    setFilters({ folder: '', tag: '', color: '', checklists: false, attachments: false });
  }

  function rememberSearch() {
    const value = search.trim();
    if (!value) return;
    const next = [value, ...recentSearches.filter((item) => item !== value)].slice(0, 6);
    setRecentSearches(next);
    localStorage.setItem(STORAGE_KEYS.recentSearches, JSON.stringify(next));
  }

  function openFolder(id) {
    setCurrentView('all');
    setFilters((current) => ({ ...current, folder: id, tag: '' }));
  }

  function openTag(tag) {
    setCurrentView('all');
    setFilters((current) => ({ ...current, tag, folder: '' }));
  }

  function toggleTheme() {
    workspace.setSettings((current) => ({ ...current, theme: isDark ? 'light' : 'dark' }));
  }

  function installUpdate() {
    const worker = updateRegistration?.waiting;
    if (!worker) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    worker.postMessage('SKIP_WAITING');
  }

  const renderCards = (notes) => notes.map((note) => (
    <NoteCard
      key={note.id}
      note={note}
      folder={foldersById.get(note.folderId)}
      query={debouncedSearch}
      viewMode={viewMode}
      onOpen={() => setEditorNote(note)}
      onPatch={(patch) => patchNote(note, patch)}
      onPdf={() => setPdfNote(note)}
      onArchive={() => archiveNote(note)}
      onTrash={() => trashNote(note)}
      onRestore={() => restoreNote(note)}
      onDelete={() => requestPermanentDelete(note)}
      onDuplicate={() => duplicateNote(note)}
    />
  ));

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <Sidebar currentView={currentView} counts={counts} onNavigate={navigate} />

      <div className="workspace-shell">
        {!online && <div className="offline-banner" role="status"><WifiOff /> أنت دون اتصال. الملاحظات المحلية تعمل، لكن النسخ الصوتي يحتاج إلى الإنترنت.</div>}
        {updateRegistration && <div className="update-banner" role="status"><span>يتوفر إصدار جديد من التطبيق.</span><button type="button" onClick={installUpdate}>تحديث الآن</button><button type="button" className="icon-only" onClick={() => setUpdateRegistration(null)} aria-label="لاحقاً"><X /></button></div>}
        {workspace.storageError && (
          <div className="storage-warning" role="alert">
            <div><strong>توقف الحفظ لحماية بياناتك القديمة.</strong><span>تعذر قراءة التخزين السابق، لذلك لم نكتب فوقه. نزّل النسخة الخام قبل بدء مساحة جديدة.</span></div>
            {workspace.recoveryRaw && <button type="button" onClick={() => downloadText(workspace.recoveryRaw, safeFilename('notes-recovery', 'json'), 'application/json')}>تنزيل بيانات الاستعادة</button>}
            <button type="button" onClick={() => { if (window.confirm('بدء مساحة جديدة سيتيح الكتابة فوق السجل غير المقروء. هل نزّلت نسخة الاستعادة؟')) workspace.unlockAfterRecovery(); }}>بدء مساحة جديدة</button>
          </div>
        )}

        <main id="main-content" className="main-content">
          <header className="workspace-header">
            <div className="workspace-heading"><span className="eyebrow">مساحة هادئة لأفكارك</span><h1>{title[0]}</h1><p>{title[1]}</p></div>
            <div className="header-actions"><button type="button" className="icon-only" onClick={toggleTheme} aria-label="تبديل السمة">{isDark ? <Sun /> : <Moon />}</button><button type="button" className="icon-only" onClick={() => navigate('settings')} aria-label="فتح الإعدادات"><Settings /></button><button type="button" className="primary-button desktop-create" onClick={createNote}><Plus /> ملاحظة جديدة</button></div>
          </header>

          {!['folders', 'tags', 'settings'].includes(currentView) && (
            <>
              <div className="search-and-controls">
                <div className="search-wrap">
                  <Search aria-hidden="true" />
                  <input ref={searchInputRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)} onKeyDown={(event) => event.key === 'Enter' && rememberSearch()} placeholder="ابحث في العناوين والمحتوى والوسوم والمجلدات" aria-label="البحث في الملاحظات" />
                  {search && <button type="button" className="icon-only" onClick={() => setSearch('')} aria-label="مسح البحث"><X /></button>}
                  {searchFocused && !search && recentSearches.length > 0 && <div className="recent-searches"><strong>عمليات البحث الأخيرة</strong>{recentSearches.map((item) => <button key={item} type="button" onClick={() => setSearch(item)}><Search /> {item}</button>)}</div>}
                </div>
                <button type="button" className={`control-button ${filterCount ? 'is-active' : ''}`} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}><Filter /> تصفية {filterCount > 0 && <b>{filterCount}</b>}<ChevronDown /></button>
              </div>

              {filtersOpen && (
                <section className="filters-panel" aria-label="عوامل تصفية الملاحظات">
                  <label>المجلد<select value={filters.folder} onChange={(event) => setFilters((current) => ({ ...current, folder: event.target.value }))}><option value="">كل المجلدات</option>{workspace.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
                  <label>الوسم<select value={filters.tag} onChange={(event) => setFilters((current) => ({ ...current, tag: event.target.value }))}><option value="">كل الوسوم</option>{allTags.map((tag) => <option key={tag} value={tag}>#{tag}</option>)}</select></label>
                  <label>اللون<select value={filters.color} onChange={(event) => setFilters((current) => ({ ...current, color: event.target.value }))}><option value="">كل الألوان</option>{NOTE_COLORS.map((color) => <option key={color.id} value={color.id}>{color.label}</option>)}</select></label>
                  <label className="check-filter"><input type="checkbox" checked={filters.checklists} onChange={(event) => setFilters((current) => ({ ...current, checklists: event.target.checked }))} /> <CheckSquare /> فيها قوائم مهام</label>
                  <label className="check-filter"><input type="checkbox" checked={filters.attachments} onChange={(event) => setFilters((current) => ({ ...current, attachments: event.target.checked }))} /> <FilePlus2 /> فيها مرفقات</label>
                  <button type="button" className="text-button" onClick={resetSearchAndFilters}>مسح الكل</button>
                </section>
              )}

              <div className="notes-toolbar">
                <p><strong>{visibleNotes.length}</strong> {visibleNotes.length === 1 ? 'ملاحظة' : 'ملاحظات'}{filters.folder && <> في <b>{foldersById.get(filters.folder)?.name}</b></>}{filters.tag && <> بالوسم <b>#{filters.tag}</b></>}</p>
                <div>
                  <label className="sort-control"><SlidersHorizontal /><span className="sr-only">ترتيب حسب</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="updated">آخر تعديل</option><option value="created">تاريخ الإنشاء</option><option value="title">العنوان</option><option value="pinned">المثبتة أولاً</option></select></label>
                  <div className="view-toggle" role="group" aria-label="طريقة العرض"><button type="button" className={viewMode === 'grid' ? 'is-active' : ''} onClick={() => setViewMode('grid')} aria-label="عرض شبكي" aria-pressed={viewMode === 'grid'}><Grid2X2 /></button><button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')} aria-label="عرض قائمة" aria-pressed={viewMode === 'list'}><List /></button></div>
                </div>
              </div>
            </>
          )}

          {currentView === 'folders' ? <FoldersPanel folders={workspace.folders} notes={workspace.notes} onCreate={workspace.createFolder} onRename={workspace.renameFolder} onDelete={workspace.deleteFolder} onOpen={openFolder} />
            : currentView === 'tags' ? <TagsPanel notes={workspace.notes} onOpen={openTag} />
              : currentView === 'settings' ? <SettingsPanel notes={workspace.notes} folders={workspace.folders} settings={workspace.settings} onSettings={workspace.setSettings} onImport={workspace.applyImport} onToast={showToast} />
                : visibleNotes.length ? <div className="notes-sections">
                  {pinnedNotes.length > 0 && <section className="notes-section" aria-labelledby="pinned-heading"><div className="section-heading"><h2 id="pinned-heading">مثبتة</h2><span>{pinnedNotes.length}</span></div><div className={`notes-layout is-${viewMode}`}>{renderCards(pinnedNotes)}</div></section>}
                  {recentNotes.length > 0 && <section className="notes-section" aria-labelledby="recent-heading"><div className="section-heading"><h2 id="recent-heading">{currentView === 'all' && pinnedNotes.length ? 'الأحدث' : title[0]}</h2><span>{recentNotes.length}</span></div><div className={`notes-layout is-${viewMode}`}>{renderCards(recentNotes)}</div></section>}
                </div> : <EmptyState view={currentView} hasQuery={Boolean(search || filterCount)} onCreate={createNote} onReset={resetSearchAndFilters} />}
        </main>
      </div>

      {!editorNote && !['trash'].includes(currentView) && <button type="button" className="floating-create" onClick={createNote} aria-label="إنشاء ملاحظة جديدة"><Plus /></button>}
      <BottomNavigation currentView={currentView} onNavigate={navigate} />

      {editorNote && (
        <Suspense fallback={<div className="editor-loading" role="status"><span /> جارٍ فتح المحرر…</div>}>
          <NoteEditor
            key={editorNote.id}
            note={workspace.notes.find((note) => note.id === editorNote.id) || editorNote}
            folders={workspace.folders}
            settings={workspace.settings}
            onSave={workspace.saveNote}
            onClose={() => setEditorNote(null)}
            onRequestPdf={setPdfNote}
            onArchive={(id) => archiveNote(workspace.notes.find((note) => note.id === id) || editorNote)}
            onTrash={(id) => trashNote(workspace.notes.find((note) => note.id === id) || editorNote)}
            onDuplicate={duplicateNote}
            onToast={showToast}
          />
        </Suspense>
      )}

      {pdfNote && <PdfExportDialog note={workspace.notes.find((note) => note.id === pdfNote.id) || pdfNote} defaults={workspace.settings} onClose={() => setPdfNote(null)} onComplete={(options) => workspace.setSettings((current) => ({ ...current, pdfPageSize: options.pageSize, pdfOrientation: options.orientation, includeTitleInPdf: options.includeTitle, includeDatesInPdf: options.includeDates, includeAttachmentsInPdf: options.includeAttachments }))} />}

      {deleteConfirmation && <Modal title="حذف الملاحظة نهائياً؟" description="هذا الإجراء يزيل الملاحظة ومرفقاتها من هذا المتصفح ولا يمكن التراجع عنه." onClose={() => setDeleteConfirmation(null)}><footer className="dialog-actions"><button type="button" className="secondary-button" onClick={() => setDeleteConfirmation(null)}>إلغاء</button><button type="button" className="danger-button" onClick={() => permanentlyDelete(deleteConfirmation)}>حذف نهائي</button></footer></Modal>}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
