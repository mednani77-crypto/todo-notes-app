import { useState } from 'react';
import {
  Archive,
  CheckSquare,
  Copy,
  FileDown,
  Heart,
  Image,
  MoreVertical,
  Paperclip,
  Pin,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { checklistProgress, detectTextDirection, formatDate, highlightParts, noteDisplayTitle } from '../lib/noteUtils.js';

function Highlight({ value, query }) {
  return highlightParts(value, query).map((part, index) => part.match
    ? <mark key={`${part.text}-${index}`}>{part.text}</mark>
    : <span key={`${part.text}-${index}`}>{part.text}</span>);
}

export default function NoteCard({
  note,
  folder,
  query,
  viewMode,
  onOpen,
  onPatch,
  onPdf,
  onArchive,
  onTrash,
  onRestore,
  onDelete,
  onDuplicate,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const progress = checklistProgress(note.content);
  const direction = detectTextDirection(`${note.title || ''} ${note.plainText || ''}`);
  const hasImages = note.attachments?.some((attachment) => attachment.kind === 'image');

  function action(callback) {
    setMenuOpen(false);
    callback();
  }

  return (
    <article className={`note-card color-${note.color} view-${viewMode}`} data-note-id={note.id}>
      <div className="note-card-topline">
        <div className="note-state-icons">
          {note.pinned && <Pin aria-label="مثبتة" />}
          {note.favorite && <Heart aria-label="مفضلة" />}
        </div>
        <div className="menu-anchor">
          <button type="button" className="icon-only card-menu-button" onClick={() => setMenuOpen((open) => !open)} aria-label={`إجراءات ${noteDisplayTitle(note)}`} aria-expanded={menuOpen}><MoreVertical /></button>
          {menuOpen && (
            <div className="context-menu card-context-menu" role="menu">
              {!note.trashedAt && <button type="button" role="menuitem" onClick={() => action(() => onPatch({ pinned: !note.pinned }))}><Pin /> {note.pinned ? 'إلغاء التثبيت' : 'تثبيت'}</button>}
              {!note.trashedAt && <button type="button" role="menuitem" onClick={() => action(() => onPatch({ favorite: !note.favorite }))}><Heart /> {note.favorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}</button>}
              <button type="button" role="menuitem" onClick={() => action(onPdf)}><FileDown /> تصدير PDF</button>
              {!note.trashedAt && <button type="button" role="menuitem" onClick={() => action(onDuplicate)}><Copy /> إنشاء نسخة</button>}
              {!note.trashedAt && <button type="button" role="menuitem" onClick={() => action(onArchive)}><Archive /> {note.archived ? 'إخراج من الأرشيف' : 'أرشفة'}</button>}
              {note.trashedAt ? <>
                <button type="button" role="menuitem" onClick={() => action(onRestore)}><RotateCcw /> استعادة</button>
                <button type="button" role="menuitem" className="danger" onClick={() => action(onDelete)}><Trash2 /> حذف نهائي</button>
              </> : <button type="button" role="menuitem" className="danger" onClick={() => action(onTrash)}><Trash2 /> نقل إلى السلة</button>}
            </div>
          )}
        </div>
      </div>

      <button type="button" className="note-open-area" onClick={onOpen} aria-label={`فتح ${noteDisplayTitle(note)}`}>
        <h3 dir="auto" aria-label={noteDisplayTitle(note)}><Highlight value={noteDisplayTitle(note)} query={query} /></h3>
        <p className="note-preview" dir={direction}><Highlight value={note.plainText || 'لا يوجد محتوى بعد'} query={query} /></p>
      </button>

      {progress.total > 0 && (
        <div className="checklist-progress" aria-label={`اكتمل ${progress.complete} من ${progress.total}`}>
          <CheckSquare />
          <div><span style={{ width: `${(progress.complete / progress.total) * 100}%` }} /></div>
          <strong>{progress.complete}/{progress.total}</strong>
        </div>
      )}

      <div className="note-card-meta">
        <div className="note-card-labels">
          {folder && <span className="folder-chip">{folder.name}</span>}
          {note.tags?.slice(0, 2).map((tag) => <span className="tag-chip-static" key={tag}>#{tag}</span>)}
          {note.tags?.length > 2 && <span className="more-tags">+{note.tags.length - 2}</span>}
        </div>
        <div className="note-card-detail-row">
          <time dateTime={new Date(note.updatedAt).toISOString()}>{formatDate(note.updatedAt)}</time>
          <span className="attachment-indicators">
            {hasImages && <Image aria-label="تتضمن صوراً" />}
            {note.attachments?.length > 0 && <><Paperclip aria-hidden="true" /> {note.attachments.length}</>}
          </span>
        </div>
      </div>
    </article>
  );
}
