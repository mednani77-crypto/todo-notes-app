import { useEffect, useRef, useState } from 'react';
import { DatabaseBackup, Download, HardDrive, Info, Upload } from 'lucide-react';
import { APP_VERSION } from '../constants.js';
import { downloadText, safeFilename } from '../lib/exporters.js';
import { mediaUsage } from '../lib/mediaDb.js';
import { buildBackup, validateBackup } from '../lib/storage.js';
import { bytesLabel } from '../lib/noteUtils.js';
import Modal from './Modal.jsx';

export default function SettingsPanel({ notes, folders, settings, onSettings, onImport, onToast }) {
  const [storage, setStorage] = useState({ used: 0, quota: 0, media: 0 });
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      navigator.storage?.estimate?.() || Promise.resolve({ usage: 0, quota: 0 }),
      mediaUsage().catch(() => 0),
    ]).then(([estimate, media]) => active && setStorage({ used: estimate.usage || 0, quota: estimate.quota || 0, media }));
    return () => { active = false; };
  }, [notes]);

  function setting(key, value) {
    onSettings((current) => ({ ...current, [key]: value }));
  }

  function exportBackup() {
    const backup = buildBackup({ notes, folders, settings });
    downloadText(JSON.stringify(backup, null, 2), safeFilename(`notes-backup-${new Date().toISOString().slice(0, 10)}`, 'json'), 'application/json;charset=utf-8');
    onToast('تم تنزيل النسخة الاحتياطية.');
  }

  async function inspectImport(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportError('');
    if (file.size > 15 * 1024 * 1024) {
      setImportError('ملف النسخة الاحتياطية أكبر من الحد الآمن 15 MB.');
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      setImportPreview(validateBackup(parsed));
    } catch (error) {
      setImportError(error.message || 'تعذر قراءة النسخة الاحتياطية.');
    }
  }

  function applyImport(mode) {
    onImport(importPreview, mode);
    setImportPreview(null);
    onToast(mode === 'replace' ? 'تم استبدال البيانات بعد إنشاء نسخة أمان محلية.' : 'تم دمج النسخة دون حذف البيانات الحالية.');
  }

  const percentage = storage.quota ? Math.min(100, (storage.used / storage.quota) * 100) : 0;

  return (
    <section className="settings-panel" aria-labelledby="settings-heading">
      <header><span className="eyebrow">تجربة تناسبك</span><h2 id="settings-heading">الإعدادات</h2><p>تُحفظ التفضيلات في هذا المتصفح.</p></header>

      <div className="settings-group">
        <h3>المظهر والقراءة</h3>
        <div className="settings-row"><div><strong>السمة</strong><small>فاتحة أو داكنة أو حسب النظام</small></div><select value={settings.theme} onChange={(event) => setting('theme', event.target.value)}><option value="system">حسب النظام</option><option value="light">فاتحة</option><option value="dark">داكنة</option></select></div>
        <div className="settings-row"><div><strong>العرض الافتراضي</strong><small>شبكة مرنة أو قائمة واسعة</small></div><select value={settings.defaultView} onChange={(event) => setting('defaultView', event.target.value)}><option value="grid">شبكة</option><option value="list">قائمة</option></select></div>
        <div className="settings-row"><div><strong>حجم خط المحرر</strong><small>يؤثر في عرض الملاحظة فقط</small></div><select value={settings.fontSize} onChange={(event) => setting('fontSize', event.target.value)}><option value="small">صغير</option><option value="medium">متوسط</option><option value="large">كبير</option></select></div>
        <div className="settings-row"><div><strong>اتجاه النص</strong><small>التلقائي مناسب للمحتوى العربي والإنجليزي المختلط</small></div><select value={settings.editorDirection} onChange={(event) => setting('editorDirection', event.target.value)}><option value="auto">تلقائي</option><option value="rtl">من اليمين</option><option value="ltr">من اليسار</option></select></div>
      </div>

      <div className="settings-group">
        <h3>السلوك</h3>
        <div className="settings-row"><div><strong>الترتيب الافتراضي</strong><small>يُطبق على شاشة كل الملاحظات</small></div><select value={settings.sort} onChange={(event) => setting('sort', event.target.value)}><option value="updated">آخر تعديل</option><option value="created">تاريخ الإنشاء</option><option value="title">العنوان</option><option value="pinned">المثبتة أولاً</option></select></div>
        <label className="settings-toggle"><div><strong>تأكيد الحذف النهائي</strong><small>يمنع حذف ملاحظة من السلة بلمسة خاطئة</small></div><input type="checkbox" checked={settings.confirmPermanentDelete} onChange={(event) => setting('confirmPermanentDelete', event.target.checked)} /></label>
      </div>

      <div className="settings-group">
        <h3>النسخ الاحتياطي والاستعادة</h3>
        <div className="backup-actions">
          <button type="button" className="secondary-button" onClick={exportBackup}><Download /> تنزيل نسخة JSON</button>
          <input ref={fileRef} type="file" hidden accept="application/json,.json" onChange={inspectImport} />
          <button type="button" className="secondary-button" onClick={() => fileRef.current?.click()}><Upload /> استيراد نسخة</button>
        </div>
        {importError && <p className="inline-error" role="alert">{importError}</p>}
        <p className="settings-note"><DatabaseBackup /> تتضمن النسخة الملاحظات والمجلدات والتفضيلات. ملفات المرفقات الثنائية تبقى في هذا الجهاز ولا تدخل حالياً في JSON.</p>
      </div>

      <div className="settings-group">
        <h3>التخزين</h3>
        <div className="storage-card"><HardDrive /><div><strong>{bytesLabel(storage.used)} مستخدمة</strong><small>من حصة تقريبية {bytesLabel(storage.quota)} · وسائط {bytesLabel(storage.media)}</small><div className="storage-meter"><span style={{ width: `${percentage}%` }} /></div></div></div>
      </div>

      <div className="about-card"><Info /><div><strong>ملاحظاتي {APP_VERSION}</strong><p>تطبيق ملاحظات عربي أولاً. التخزين محلي، والنسخ الصوتي فقط يُرسل خارج الجهاز عند طلبك.</p></div></div>

      {importPreview && (
        <Modal title="معاينة الاستيراد" description={`تتضمن النسخة ${importPreview.notes.length} ملاحظة و${importPreview.folders.length} مجلداً.`} onClose={() => setImportPreview(null)}>
          <div className="import-summary"><p><strong>الدمج:</strong> يحافظ على بياناتك ويضيف الملاحظات، مع إنشاء معرّفات جديدة للتكرارات.</p><p><strong>الاستبدال:</strong> يستبدل الملاحظات والمجلدات بعد حفظ نسخة أمان محلية تلقائياً.</p></div>
          <footer className="dialog-actions"><button type="button" className="secondary-button" onClick={() => applyImport('merge')}>دمج البيانات</button><button type="button" className="danger-button" onClick={() => applyImport('replace')}>استبدال بعد نسخة أمان</button></footer>
        </Modal>
      )}
    </section>
  );
}
