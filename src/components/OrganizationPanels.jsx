import { useState } from 'react';
import { Edit3, FolderPlus, Hash, Trash2 } from 'lucide-react';

export function FoldersPanel({ folders, notes, onCreate, onRename, onDelete, onOpen }) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  function create(event) {
    event.preventDefault();
    if (onCreate(name)) setName('');
  }

  function saveRename(id) {
    onRename(id, editingName);
    setEditingId(null);
  }

  return (
    <section className="management-panel" aria-labelledby="folders-heading">
      <header><div><span className="eyebrow">تنظيم مرن</span><h2 id="folders-heading">المجلدات</h2><p>احفظ كل مشروع في مكان واضح. حذف المجلد لا يحذف ملاحظاته.</p></div></header>
      <form className="create-folder-form" onSubmit={create}>
        <label htmlFor="folder-name" className="sr-only">اسم المجلد الجديد</label>
        <input id="folder-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="اسم مجلد جديد" maxLength="80" />
        <button type="submit" className="primary-button" disabled={!name.trim()}><FolderPlus /> إنشاء مجلد</button>
      </form>
      <div className="folder-list">
        {folders.length ? folders.map((folder) => {
          const count = notes.filter((note) => note.folderId === folder.id && !note.trashedAt).length;
          return (
            <article className="folder-row" key={folder.id}>
              <button type="button" className="folder-open" onClick={() => onOpen(folder.id)}><span className="folder-icon" aria-hidden="true" /><div>{editingId === folder.id ? <input value={editingName} onChange={(event) => setEditingName(event.target.value)} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.key === 'Enter' && saveRename(folder.id)} autoFocus /> : <strong>{folder.name}</strong>}<small>{count} {count === 1 ? 'ملاحظة' : 'ملاحظات'}</small></div></button>
              <div className="row-actions">
                {editingId === folder.id ? <button type="button" onClick={() => saveRename(folder.id)}>حفظ</button> : <button type="button" className="icon-only" aria-label={`إعادة تسمية ${folder.name}`} onClick={() => { setEditingId(folder.id); setEditingName(folder.name); }}><Edit3 /></button>}
                <button type="button" className="icon-only danger" aria-label={`حذف مجلد ${folder.name}`} onClick={() => { if (window.confirm(`حذف مجلد «${folder.name}»؟ ستبقى ملاحظاته دون مجلد.`)) onDelete(folder.id); }}><Trash2 /></button>
              </div>
            </article>
          );
        }) : <div className="compact-empty"><FolderPlus /><h3>لا توجد مجلدات بعد</h3><p>أنشئ مجلداً للمشاريع أو الدراسة أو الأفكار.</p></div>}
      </div>
    </section>
  );
}

export function TagsPanel({ notes, onOpen }) {
  const counts = new Map();
  notes.filter((note) => !note.trashedAt).forEach((note) => note.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
  const tags = [...counts.entries()].sort((first, second) => first[0].localeCompare(second[0], 'ar'));
  return (
    <section className="management-panel" aria-labelledby="tags-heading">
      <header><div><span className="eyebrow">وصول سريع</span><h2 id="tags-heading">الوسوم</h2><p>تُنشأ الوسوم من داخل المحرر، ويمكن لكل ملاحظة حمل أكثر من وسم.</p></div></header>
      <div className="tags-cloud">
        {tags.length ? tags.map(([tag, count]) => <button key={tag} type="button" onClick={() => onOpen(tag)}><Hash /> <strong>{tag}</strong><span>{count}</span></button>) : <div className="compact-empty"><Hash /><h3>لا توجد وسوم</h3><p>أضف وسماً من خصائص أي ملاحظة.</p></div>}
      </div>
    </section>
  );
}
