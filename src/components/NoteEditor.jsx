import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArrowRight,
  Check,
  Copy,
  Download,
  FileDown,
  FileText,
  Heart,
  Info,
  MoreVertical,
  Paperclip,
  Pin,
  Share2,
  Tags,
  Trash2,
} from 'lucide-react';
import { ACCEPTED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, NOTE_COLORS } from '../constants.js';
import { downloadText, noteAsMarkdown, noteAsText, safeFilename, shareNote } from '../lib/exporters.js';
import { putMedia } from '../lib/mediaDb.js';
import { bytesLabel, createId, detectTextDirection, escapeHtml, formatDate } from '../lib/noteUtils.js';
import AttachmentList from './AttachmentList.jsx';
import RichTextEditor from './RichTextEditor.jsx';
import VoiceRecorder from './VoiceRecorder.jsx';

function hasMeaningfulContent(note) {
  return Boolean(note.title?.trim() || note.plainText?.trim() || note.attachments?.length);
}

export default function NoteEditor({
  note,
  folders,
  settings,
  onSave,
  onClose,
  onRequestPdf,
  onArchive,
  onTrash,
  onDuplicate,
  onToast,
}) {
  const [draft, setDraft] = useState(note);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const dirtyRef = useRef(false);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return undefined;
    }
    dirtyRef.current = true;
    if (!hasMeaningfulContent(draft)) return undefined;
    queueMicrotask(() => setSaveStatus('saving'));
    const timer = window.setTimeout(() => {
      try {
        onSave(draft);
        dirtyRef.current = false;
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, settings.autoSaveDelay || 650);
    return () => window.clearTimeout(timer);
  }, [draft, onSave, settings.autoSaveDelay]);

  useEffect(() => {
    function warnOnClose(event) {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warnOnClose);
    return () => window.removeEventListener('beforeunload', warnOnClose);
  }, []);

  const setEditor = useCallback((editor) => { editorRef.current = editor; }, []);

  function flush() {
    if (hasMeaningfulContent(draft) && dirtyRef.current) {
      onSave(draft);
      dirtyRef.current = false;
      setSaveStatus('saved');
    }
  }

  function closeEditor() {
    flush();
    onClose();
  }

  function patchDraft(patch) {
    setDraft((current) => ({ ...current, ...patch, updatedAt: Date.now() }));
  }

  function addTag(value) {
    const tag = String(value).replace(/^#/, '').trim().slice(0, 40);
    if (!tag || draft.tags.includes(tag)) return;
    patchDraft({ tags: [...draft.tags, tag].slice(0, 20) });
    setTagDraft('');
  }

  function handleTagKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(tagDraft);
    }
  }

  async function addFiles(fileList) {
    setAttachmentError('');
    const nextAttachments = [];
    for (const file of fileList) {
      if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
        setAttachmentError(`نوع الملف ${file.name} غير مدعوم.`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachmentError(`الملف ${file.name} أكبر من 10 MB.`);
        continue;
      }
      const id = createId();
      try {
        await putMedia({ id, blob: file, createdAt: Date.now() });
        nextAttachments.push({
          id,
          name: file.name.replace(/[\\/:*?"<>|]/g, '-').slice(0, 160),
          type: file.type,
          size: file.size,
          kind: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file',
          createdAt: Date.now(),
        });
      } catch {
        setAttachmentError(`تعذر حفظ ${file.name} في تخزين المتصفح.`);
      }
    }
    if (nextAttachments.length) {
      setDraft((current) => ({ ...current, attachments: [...current.attachments, ...nextAttachments], updatedAt: Date.now() }));
      onToast?.(`تمت إضافة ${nextAttachments.length} من المرفقات.`);
    }
  }

  async function keepVoiceRecording(blob, duration) {
    const id = createId();
    const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
    const name = `voice-note-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
    await putMedia({ id, blob, createdAt: Date.now(), duration });
    const attachment = { id, name, type: blob.type, size: blob.size, kind: 'audio', createdAt: Date.now(), duration };
    setDraft((current) => ({ ...current, attachments: [...current.attachments, attachment], updatedAt: Date.now() }));
    return id;
  }

  function insertTranscript(text, mode) {
    const editor = editorRef.current;
    if (!editor) return;
    const direction = detectTextDirection(text);
    const safeText = escapeHtml(text).replace(/\r?\n/g, '<br>');
    if (mode === 'section') {
      editor.chain().focus('end').insertContent(`<h2>نسخ صوتي</h2><p dir="${direction}">${safeText}</p>`).run();
    } else {
      editor.chain().focus().insertContent(`<span dir="${direction}">${safeText}</span>`).run();
    }
    onToast?.('تم إدراج النص في الملاحظة.');
  }

  async function share() {
    flush();
    try {
      const result = await shareNote(draft);
      onToast?.(result === 'shared' ? 'تم فتح المشاركة.' : result === 'copied' ? 'نُسخت الملاحظة إلى الحافظة.' : 'تم تنزيل نسخة نصية.');
    } catch (error) {
      if (error?.name !== 'AbortError') onToast?.('تعذرت المشاركة في هذا المتصفح.');
    }
  }

  function requestPdf() {
    flush();
    onRequestPdf(draft);
  }

  function archive() {
    flush();
    onArchive(draft.id);
    onClose();
  }

  function trash() {
    flush();
    onTrash(draft.id);
    onClose();
  }

  return (
    <div className="editor-page" role="dialog" aria-modal="true" aria-labelledby="note-editor-title">
      <header className="editor-page-header">
        <div className="editor-leading-actions">
          <button type="button" className="icon-only" onClick={closeEditor} aria-label="العودة إلى الملاحظات"><ArrowRight /></button>
          <div className={`save-state is-${saveStatus}`} aria-live="polite">
            {saveStatus === 'saving' ? 'جارٍ الحفظ…' : saveStatus === 'error' ? 'تعذر الحفظ' : <><Check /> محفوظة</>}
          </div>
        </div>
        <div className="editor-header-actions">
          <button type="button" className={`icon-only ${draft.pinned ? 'is-active' : ''}`} onClick={() => patchDraft({ pinned: !draft.pinned })} aria-label={draft.pinned ? 'إلغاء التثبيت' : 'تثبيت الملاحظة'} aria-pressed={draft.pinned}><Pin /></button>
          <button type="button" className={`icon-only ${draft.favorite ? 'is-active' : ''}`} onClick={() => patchDraft({ favorite: !draft.favorite })} aria-label={draft.favorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'} aria-pressed={draft.favorite}><Heart /></button>
          <button type="button" className="pdf-header-action" onClick={requestPdf}><FileDown /> PDF</button>
          <div className="menu-anchor">
            <button type="button" className="icon-only" onClick={() => setMenuOpen((open) => !open)} aria-label="المزيد من إجراءات الملاحظة" aria-expanded={menuOpen}><MoreVertical /></button>
            {menuOpen && (
              <div className="context-menu editor-menu" role="menu">
                <button type="button" role="menuitem" onClick={share}><Share2 /> مشاركة</button>
                <button type="button" role="menuitem" onClick={() => { flush(); onDuplicate(draft); }}><Copy /> إنشاء نسخة</button>
                <button type="button" role="menuitem" onClick={() => downloadText(noteAsMarkdown(draft), safeFilename(draft.title || 'note', 'md'), 'text/markdown;charset=utf-8')}><Download /> تنزيل Markdown</button>
                <button type="button" role="menuitem" onClick={() => downloadText(noteAsText(draft), safeFilename(draft.title || 'note', 'txt'))}><FileText /> تنزيل نص</button>
                <button type="button" role="menuitem" onClick={archive}><Archive /> نقل إلى الأرشيف</button>
                <button type="button" role="menuitem" className="danger" onClick={trash}><Trash2 /> نقل إلى السلة</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="editor-page-body">
        <div className="editor-document">
          <input
            id="note-editor-title"
            className="note-title-input"
            value={draft.title}
            onChange={(event) => patchDraft({ title: event.target.value.slice(0, 240) })}
            placeholder="عنوان الملاحظة"
            aria-label="عنوان الملاحظة"
            dir="auto"
          />
          <div className="note-dates"><Info /> أُنشئت {formatDate(draft.createdAt, { time: true })} · عُدّلت {formatDate(draft.updatedAt, { time: true })}</div>
          <RichTextEditor
            content={draft.content}
            direction={settings.editorDirection}
            onReady={setEditor}
            onPasteFiles={addFiles}
            onChange={({ html, text }) => patchDraft({ content: html, plainText: text, text })}
          />

          <section className="note-properties" aria-label="تنظيم الملاحظة">
            <label>المجلد
              <select value={draft.folderId || ''} onChange={(event) => patchDraft({ folderId: event.target.value || null })}>
                <option value="">بدون مجلد</option>
                {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            </label>
            <div className="tag-editor">
              <span><Tags /> الوسوم</span>
              <div className="tag-input-row">
                {draft.tags.map((tag) => <button key={tag} type="button" className="tag-chip" onClick={() => patchDraft({ tags: draft.tags.filter((item) => item !== tag) })} title="إزالة الوسم">#{tag} ×</button>)}
                <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={handleTagKeyDown} onBlur={() => addTag(tagDraft)} placeholder="أضف وسماً" aria-label="إضافة وسم" />
              </div>
            </div>
            <div className="color-picker" role="group" aria-label="لون الملاحظة">
              <span>لون البطاقة</span>
              <div>{NOTE_COLORS.map((color) => <button key={color.id} type="button" className={`color-swatch color-${color.id} ${draft.color === color.id ? 'is-selected' : ''}`} aria-label={color.label} aria-pressed={draft.color === color.id} onClick={() => patchDraft({ color: color.id })} />)}</div>
            </div>
          </section>

          <div className="attachment-add-row">
            <input ref={fileInputRef} type="file" multiple hidden accept={ACCEPTED_ATTACHMENT_TYPES.join(',')} onChange={(event) => { addFiles([...event.target.files]); event.target.value = ''; }} />
            <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()}><Paperclip /> إضافة صورة أو ملف</button>
            <span>حتى 10 MB للملف · {draft.attachments.length} مرفق</span>
          </div>
          {attachmentError && <p className="inline-error" role="alert">{attachmentError}</p>}
          <AttachmentList attachments={draft.attachments} onRemove={(id) => patchDraft({ attachments: draft.attachments.filter((attachment) => attachment.id !== id) })} />
          <VoiceRecorder onInsert={insertTranscript} onKeepAudio={keepVoiceRecording} />
        </div>
      </main>
      <div className="editor-mobile-footer">
        <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()}><Paperclip /> مرفق</button>
        <button type="button" className="primary-button" onClick={closeEditor}><Check /> تم</button>
      </div>
      <span className="sr-only">حجم المرفقات الأقصى {bytesLabel(MAX_ATTACHMENT_BYTES)}</span>
    </div>
  );
}
