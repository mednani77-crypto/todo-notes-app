import { getMedia } from './mediaDb.js';
import {
  detectTextDirection,
  escapeHtml,
  formatDate,
  noteDisplayTitle,
  stripHtml,
} from './noteUtils.js';
import { sanitizeNoteHtml } from './storage.js';

export function safeFilename(value, extension) {
  const withoutControls = [...String(value || 'note')].filter((character) => character.charCodeAt(0) >= 32).join('');
  const base = withoutControls
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90) || 'note';
  return `${base}.${extension}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(value, filename, type = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([value], { type }), filename);
}

export function htmlToMarkdown(html = '') {
  if (typeof DOMParser === 'undefined') return stripHtml(html);
  const root = new DOMParser().parseFromString(String(html), 'text/html').body;

  function walk(node, depth = 0) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    const content = [...node.childNodes].map((child) => walk(child, depth + 1)).join('');
    if (tag === 'strong' || tag === 'b') return `**${content}**`;
    if (tag === 'em' || tag === 'i') return `*${content}*`;
    if (tag === 's' || tag === 'strike') return `~~${content}~~`;
    if (tag === 'blockquote') return `> ${content.trim()}\n\n`;
    if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${content.trim()}\n\n`;
    if (tag === 'br') return '\n';
    if (tag === 'a') return `[${content}](${node.getAttribute('href') || ''})`;
    if (tag === 'li') {
      const checked = node.getAttribute('data-checked');
      const marker = checked === 'true' ? '- [x]' : checked === 'false' ? '- [ ]' : '-';
      return `${marker} ${content.trim()}\n`;
    }
    if (tag === 'ol' || tag === 'ul') return `${content}\n`;
    if (tag === 'p') return `${content.trim()}\n\n`;
    return content;
  }

  return walk(root).replace(/\n{3,}/g, '\n\n').trim();
}

export function noteAsText(note) {
  return [noteDisplayTitle(note), '', stripHtml(note.content || note.text || '')].join('\n').trim();
}

export function noteAsMarkdown(note) {
  return [`# ${noteDisplayTitle(note)}`, '', htmlToMarkdown(note.content)].join('\n').trim();
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function buildPdfSource(note, options) {
  const title = noteDisplayTitle(note);
  const direction = detectTextDirection(`${note.title || ''} ${note.plainText || ''}`);
  const source = document.createElement('article');
  source.lang = direction === 'rtl' ? 'ar' : 'en';
  source.dir = direction;
  source.className = 'pdf-note-source';
  source.style.cssText = [
    'width:180mm',
    'min-height:240mm',
    'padding:4mm',
    'background:#ffffff',
    'color:#1f211f',
    'font-family:system-ui,"Noto Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif',
    'font-size:12pt',
    'line-height:1.85',
    'overflow-wrap:anywhere',
    'unicode-bidi:plaintext',
  ].join(';');

  const style = document.createElement('style');
  style.textContent = `
    .pdf-note-source h1{font-size:26pt;line-height:1.35;margin:0 0 8mm;font-weight:800;page-break-after:avoid}
    .pdf-note-source h2{font-size:20pt;line-height:1.4;margin:7mm 0 3mm;page-break-after:avoid}
    .pdf-note-source h3{font-size:16pt;line-height:1.45;margin:6mm 0 2mm;page-break-after:avoid}
    .pdf-note-source p{margin:0 0 3.5mm;white-space:normal}
    .pdf-note-source ul,.pdf-note-source ol{padding-inline-start:7mm;margin:0 0 4mm}
    .pdf-note-source li{margin:0 0 1.8mm;page-break-inside:avoid}
    .pdf-note-source blockquote{border-inline-start:3px solid #b8a16b;margin:5mm 0;padding:2mm 5mm;color:#555b55;background:#f8f6ef;page-break-inside:avoid}
    .pdf-note-source a{color:#315f8a;text-decoration:underline}
    .pdf-note-source img{display:block;max-width:100%;max-height:110mm;object-fit:contain;margin:5mm auto;page-break-inside:avoid}
    .pdf-note-source ul[data-type="taskList"]{list-style:none;padding-inline-start:0}
    .pdf-note-source li[data-checked]::before{display:inline-block;width:5mm;margin-inline-end:2mm;content:"☐"}
    .pdf-note-source li[data-checked="true"]::before{content:"☑"}
    .pdf-note-source li[data-checked="true"]>div{text-decoration:line-through;color:#6f746f}
    .pdf-note-source .pdf-meta{color:#6f746f;font-size:9.5pt;border-bottom:1px solid #dedbd2;padding-bottom:4mm;margin-bottom:8mm}
    .pdf-note-source .pdf-attachments{margin-top:10mm;padding-top:5mm;border-top:1px solid #dedbd2;page-break-before:auto}
    .pdf-note-source .pdf-attachment-image{page-break-inside:avoid;margin-top:6mm}
  `;
  source.append(style);

  if (options.includeTitle) {
    const heading = document.createElement('h1');
    heading.textContent = title;
    heading.dir = 'auto';
    source.append(heading);
  }

  if (options.includeDates) {
    const meta = document.createElement('div');
    meta.className = 'pdf-meta';
    meta.textContent = `أُنشئت ${formatDate(note.createdAt, { alwaysYear: true, time: true })} · عُدّلت ${formatDate(note.updatedAt, { alwaysYear: true, time: true })}`;
    source.append(meta);
  }

  const content = document.createElement('section');
  content.dir = 'auto';
  content.innerHTML = sanitizeNoteHtml(note.content || `<p>${escapeHtml(note.text || '')}</p>`);
  source.append(content);

  if (options.includeAttachments && note.attachments?.length) {
    const attachments = document.createElement('section');
    attachments.className = 'pdf-attachments';
    const heading = document.createElement('h2');
    heading.textContent = 'المرفقات';
    attachments.append(heading);
    const list = document.createElement('ul');
    for (const attachment of note.attachments) {
      const item = document.createElement('li');
      item.textContent = `${attachment.name} (${Math.max(1, Math.round(attachment.size / 1024))} KB)`;
      list.append(item);
      if (attachment.kind === 'image') {
        try {
          const record = await getMedia(attachment.id);
          if (record?.blob) {
            const image = document.createElement('img');
            image.className = 'pdf-attachment-image';
            image.alt = attachment.name;
            image.src = await blobToDataUrl(record.blob);
            attachments.append(image);
          }
        } catch { /* list metadata still exports if the local blob is unavailable */ }
      }
    }
    heading.after(list);
    source.append(attachments);
  }
  return source;
}

export async function exportNotePdf(note, options = {}) {
  const resolvedOptions = {
    pageSize: 'a4',
    orientation: 'portrait',
    includeTitle: true,
    includeDates: true,
    includeAttachments: true,
    ...options,
  };
  const source = await buildPdfSource(note, resolvedOptions);
  const renderHost = document.createElement('div');
  renderHost.setAttribute('aria-hidden', 'true');
  renderHost.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#fff;overflow:auto;pointer-events:none';
  renderHost.append(source);
  document.body.append(renderHost);
  try {
    await document.fonts?.ready;
    await Promise.all([...source.querySelectorAll('img')].map((image) => (
      image.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
          })
    )));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const module = await import('html2pdf.js');
    const html2pdf = module.default || module;
    await html2pdf().set({
      margin: [14, 15, 17, 15],
      filename: safeFilename(noteDisplayTitle(note), 'pdf'),
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
      jsPDF: { unit: 'mm', format: resolvedOptions.pageSize, orientation: resolvedOptions.orientation },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['img', 'blockquote', 'li'] },
    }).from(source).save();
  } finally {
    renderHost.remove();
  }
}

export function openPrintPreview(note, options = {}) {
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) throw new Error('popup-blocked');
  const direction = detectTextDirection(`${note.title || ''} ${note.plainText || ''}`);
  popup.document.write(`<!doctype html><html lang="${direction === 'rtl' ? 'ar' : 'en'}" dir="${direction}"><head><meta charset="UTF-8"><title>${escapeHtml(noteDisplayTitle(note))}</title><style>body{max-width:760px;margin:15mm auto;padding:0 10mm;color:#20231f;font-family:system-ui,"Noto Sans Arabic",Tahoma,sans-serif;line-height:1.85;unicode-bidi:plaintext}h1{font-size:30px}.meta{color:#6d726d;border-bottom:1px solid #ddd;padding-bottom:12px;margin-bottom:24px}img{max-width:100%}@media print{body{margin:0;max-width:none}}</style></head><body>${options.includeTitle === false ? '' : `<h1>${escapeHtml(noteDisplayTitle(note))}</h1>`}${options.includeDates === false ? '' : `<p class="meta">${escapeHtml(formatDate(note.updatedAt, { alwaysYear: true, time: true }))}</p>`}<main dir="auto">${sanitizeNoteHtml(note.content)}</main></body></html>`);
  popup.document.close();
  popup.focus();
  return popup;
}

export async function shareNote(note) {
  const text = noteAsText(note);
  if (navigator.share) {
    await navigator.share({ title: noteDisplayTitle(note), text });
    return 'shared';
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return 'copied';
  }
  downloadText(text, safeFilename(noteDisplayTitle(note), 'txt'));
  return 'downloaded';
}
