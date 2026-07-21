import { useState } from 'react';
import { Eye, FileDown, LoaderCircle } from 'lucide-react';
import Modal from './Modal.jsx';
import { exportNotePdf, openPrintPreview } from '../lib/exporters.js';

export default function PdfExportDialog({ note, defaults, onClose, onComplete }) {
  const [options, setOptions] = useState({
    pageSize: defaults?.pdfPageSize || 'a4',
    orientation: defaults?.pdfOrientation || 'portrait',
    includeTitle: defaults?.includeTitleInPdf ?? true,
    includeDates: defaults?.includeDatesInPdf ?? true,
    includeAttachments: defaults?.includeAttachmentsInPdf ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function patch(key, value) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  async function exportPdf() {
    setBusy(true);
    setError('');
    try {
      await exportNotePdf(note, options);
      onComplete?.(options);
      onClose();
    } catch (caught) {
      console.warn('PDF export failed.', caught?.name);
      setError('تعذر إنشاء ملف PDF. تحقق من وجود مساحة كافية ثم حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  function preview() {
    try {
      openPrintPreview(note, options);
    } catch {
      setError('منع المتصفح نافذة المعاينة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.');
    }
  }

  return (
    <Modal title="تصدير الملاحظة كـ PDF" description="اضبط شكل الصفحات قبل إنشاء الملف القابل للتنزيل." onClose={busy ? () => {} : onClose} className="pdf-dialog">
      <div className="option-grid">
        <label>حجم الصفحة
          <select value={options.pageSize} onChange={(event) => patch('pageSize', event.target.value)}>
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </select>
        </label>
        <label>اتجاه الصفحة
          <select value={options.orientation} onChange={(event) => patch('orientation', event.target.value)}>
            <option value="portrait">عمودي</option>
            <option value="landscape">أفقي</option>
          </select>
        </label>
      </div>
      <div className="check-options">
        <label><input type="checkbox" checked={options.includeTitle} onChange={(event) => patch('includeTitle', event.target.checked)} /> تضمين عنوان الملاحظة</label>
        <label><input type="checkbox" checked={options.includeDates} onChange={(event) => patch('includeDates', event.target.checked)} /> تضمين تاريخ الإنشاء والتعديل</label>
        <label><input type="checkbox" checked={options.includeAttachments} onChange={(event) => patch('includeAttachments', event.target.checked)} /> تضمين قائمة المرفقات والصور</label>
      </div>
      <p className="dialog-hint">يُرسم النص العربي والمحتوى المختلط بصرياً داخل الملف لضمان اتجاه صحيح على Android وسطح المكتب.</p>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <footer className="dialog-actions">
        <button type="button" className="secondary-button" onClick={preview} disabled={busy}><Eye /> معاينة الطباعة</button>
        <button type="button" className="primary-button" onClick={exportPdf} disabled={busy}>
          {busy ? <LoaderCircle className="spin" /> : <FileDown />}
          {busy ? 'جارٍ إنشاء الملف…' : 'تنزيل PDF'}
        </button>
      </footer>
    </Modal>
  );
}
