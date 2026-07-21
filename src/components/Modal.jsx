import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, description, children, onClose, className = '', labelledBy }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
    document.body.classList.add('modal-open');

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('modal-open');
      previousFocusRef.current?.focus?.();
    };
  }, [onClose]);

  const titleId = labelledBy || `dialog-${title.replace(/\s+/g, '-')}`;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className={`modal-card ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="icon-only" onClick={onClose} aria-label="إغلاق"><X /></button>
        </header>
        {children}
      </section>
    </div>
  );
}
