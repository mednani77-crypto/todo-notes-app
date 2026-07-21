import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  Eraser,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  UnderlineIcon,
  Undo2,
} from 'lucide-react';

function ToolButton({ label, active = false, disabled = false, onClick, children }) {
  return (
    <button
      type="button"
      className="editor-tool"
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  content,
  direction = 'auto',
  onChange,
  onReady,
  onPasteFiles,
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'ابدأ الكتابة…' }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'rich-editor-content',
        dir: direction,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'محتوى الملاحظة',
      },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files || [])];
        if (!files.length || !onPasteFiles) return false;
        onPasteFiles(files);
        return true;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange({ html: currentEditor.getHTML(), text: currentEditor.getText({ blockSeparator: '\n' }) });
    },
  });

  useEffect(() => {
    onReady?.(editor);
    return () => onReady?.(null);
  }, [editor, onReady]);

  if (!editor) return <div className="editor-loading" aria-label="جارٍ تحميل المحرر" />;

  function editLink() {
    const previous = editor.getAttributes('link').href || '';
    const href = window.prompt('أدخل رابطاً آمناً يبدأ بـ https://', previous);
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const normalized = /^https?:\/\//i.test(href.trim()) ? href.trim() : `https://${href.trim()}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run();
  }

  return (
    <div className="rich-editor">
      <div className="editor-toolbar" role="toolbar" aria-label="تنسيق النص">
        <ToolButton label="تراجع" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 /></ToolButton>
        <ToolButton label="إعادة" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 /></ToolButton>
        <span className="tool-divider" />
        <ToolButton label="عنوان رئيسي" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 /></ToolButton>
        <ToolButton label="عنوان فرعي" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></ToolButton>
        <ToolButton label="غامق" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></ToolButton>
        <ToolButton label="مائل" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></ToolButton>
        <ToolButton label="تحته خط" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon /></ToolButton>
        <ToolButton label="يتوسطه خط" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough /></ToolButton>
        <span className="tool-divider" />
        <ToolButton label="قائمة نقطية" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></ToolButton>
        <ToolButton label="قائمة رقمية" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></ToolButton>
        <ToolButton label="قائمة مهام" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}><CheckSquare /></ToolButton>
        <ToolButton label="اقتباس" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></ToolButton>
        <ToolButton label="رابط" active={editor.isActive('link')} onClick={editLink}><Link2 /></ToolButton>
        <span className="tool-divider" />
        <ToolButton label="محاذاة لليمين" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight /></ToolButton>
        <ToolButton label="توسيط" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter /></ToolButton>
        <ToolButton label="محاذاة لليسار" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft /></ToolButton>
        <ToolButton label="مسح التنسيق" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><Eraser /></ToolButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
