import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportNotePdf, htmlToMarkdown, safeFilename } from './exporters.js';
import { normalizeNote } from './storage.js';

const pdfMock = vi.hoisted(() => {
  const worker = {};
  worker.set = vi.fn(() => worker);
  worker.from = vi.fn((source) => {
    worker.capturedLayout = {
      sourcePosition: source.style.position,
      hostPosition: source.parentElement?.style.position,
    };
    return worker;
  });
  worker.save = vi.fn(async () => undefined);
  return { worker, factory: vi.fn(() => worker) };
});

vi.mock('html2pdf.js', () => ({ default: pdfMock.factory }));

describe('PDF and file export', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a safe filename while preserving readable Arabic', () => {
    expect(safeFilename('خطة: يوليو/2026?', 'pdf')).toBe('خطة- يوليو-2026-.pdf');
  });

  it('creates a direct downloadable PDF job with Arabic, English, checklist, and pagination options', async () => {
    const note = normalizeNote({
      title: 'خطة Mixed plan',
      content: '<h2>العربية English</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><div><p>مكتمل</p></div></li><li data-type="taskItem" data-checked="false"><div><p>Open</p></div></li></ul><p>نص طويل</p>',
      createdAt: 1,
      updatedAt: 2,
    });
    await exportNotePdf(note, { pageSize: 'letter', orientation: 'landscape', includeDates: true, includeTitle: true });
    expect(pdfMock.factory).toHaveBeenCalledOnce();
    expect(pdfMock.worker.set).toHaveBeenCalledWith(expect.objectContaining({
      filename: expect.stringContaining('.pdf'),
      jsPDF: expect.objectContaining({ format: 'letter', orientation: 'landscape' }),
      pagebreak: expect.objectContaining({ mode: ['css', 'legacy'] }),
    }));
    const source = pdfMock.worker.from.mock.calls[0][0];
    expect(source.textContent).toContain('خطة Mixed plan');
    expect(source.innerHTML).toContain('data-checked="true"');
    expect(pdfMock.worker.capturedLayout).toEqual({ sourcePosition: '', hostPosition: 'fixed' });
    expect(pdfMock.worker.save).toHaveBeenCalledOnce();
    expect(document.body.contains(source)).toBe(false);
  });

  it('converts headings, formatting, links, and checklists to Markdown', () => {
    const markdown = htmlToMarkdown('<h2>Heading</h2><p><strong>Bold</strong> <a href="https://example.com">link</a></p><ul><li data-checked="true">Done</li></ul>');
    expect(markdown).toContain('## Heading');
    expect(markdown).toContain('**Bold**');
    expect(markdown).toContain('[link](https://example.com)');
    expect(markdown).toContain('- [x] Done');
  });
});
