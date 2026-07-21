import {
  Archive,
  FileHeart,
  Folder,
  Hash,
  ListTodo,
  Pin,
  Settings,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { NAV_ITEMS } from '../constants.js';

const ICONS = {
  all: StickyNote,
  pinned: Pin,
  favorites: FileHeart,
  folders: Folder,
  tags: Hash,
  archive: Archive,
  trash: Trash2,
  settings: Settings,
};

export function Sidebar({ currentView, counts, onNavigate }) {
  return (
    <aside className="sidebar" aria-label="التنقل الرئيسي">
      <div className="sidebar-brand"><span className="brand-mark"><ListTodo /></span><div><strong>ملاحظاتي</strong><small>مساحتك الخاصة</small></div></div>
      <nav>
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.id];
          return <button key={item.id} type="button" className={currentView === item.id ? 'is-current' : ''} onClick={() => onNavigate(item.id)} aria-label={item.label} aria-current={currentView === item.id ? 'page' : undefined}><Icon /><span>{item.label}</span>{counts[item.id] != null && <b aria-hidden="true">{counts[item.id]}</b>}</button>;
        })}
      </nav>
      <div className="sidebar-foot"><span>محفوظ محلياً</span><small>بياناتك تبقى في هذا المتصفح</small></div>
    </aside>
  );
}

export function BottomNavigation({ currentView, onNavigate }) {
  const items = NAV_ITEMS.filter((item) => ['all', 'pinned', 'folders', 'settings'].includes(item.id));
  return (
    <nav className="bottom-navigation" aria-label="التنقل على الهاتف">
      {items.map((item) => {
        const Icon = ICONS[item.id];
        return <button key={item.id} type="button" className={currentView === item.id ? 'is-current' : ''} onClick={() => onNavigate(item.id)} aria-current={currentView === item.id ? 'page' : undefined}><Icon /><span>{item.label.replace('كل ', '')}</span></button>;
      })}
    </nav>
  );
}
