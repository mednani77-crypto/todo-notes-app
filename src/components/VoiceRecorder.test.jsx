import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VoiceRecorder from './VoiceRecorder.jsx';

class MockMediaRecorder {
  static isTypeSupported() { return true; }
  constructor(stream, options) {
    this.stream = stream;
    this.mimeType = options?.mimeType || 'audio/webm';
    this.state = 'inactive';
  }
  start() { this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['recorded-audio'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

describe('VoiceRecorder', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    });
  });

  async function makeRecording(user) {
    await user.click(screen.getByRole('button', { name: 'بدء تسجيل جديد' }));
    expect(await screen.findByText('جارٍ التسجيل', { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'إيقاف' }));
    expect(await screen.findByText('التسجيل جاهز للمعاينة', { exact: false })).toBeInTheDocument();
  }

  it('records, pauses, resumes, and stops without losing the recording', async () => {
    const user = userEvent.setup();
    render(<VoiceRecorder onInsert={vi.fn()} onKeepAudio={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'بدء تسجيل جديد' }));
    await user.click(screen.getByRole('button', { name: 'إيقاف مؤقت' }));
    expect(screen.getByText('التسجيل متوقف مؤقتاً', { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'متابعة' }));
    expect(screen.getByText('جارٍ التسجيل', { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'إيقاف' }));
    expect(await screen.findByLabelText('حذف التسجيل')).toBeInTheDocument();
  });

  it('transcribes successfully and inserts editable Arabic text at the cursor', async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    const onKeepAudio = vi.fn().mockResolvedValue('audio-id');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'نص عربي قابل للتحرير.' }) }));
    render(<VoiceRecorder onInsert={onInsert} onKeepAudio={onKeepAudio} />);
    await makeRecording(user);
    await user.click(screen.getByRole('button', { name: 'تحويل إلى نص' }));
    const transcript = await screen.findByLabelText('النص الناتج — يمكنك تعديله قبل الإدراج');
    expect(transcript).toHaveValue('نص عربي قابل للتحرير.');
    await user.clear(transcript);
    await user.type(transcript, 'نص معدل');
    await user.click(screen.getByRole('button', { name: 'إدراج عند المؤشر' }));
    expect(onInsert).toHaveBeenCalledWith('نص معدل', 'cursor');
    expect(onKeepAudio).toHaveBeenCalledOnce();
  });

  it('keeps a failed recording and retries transcription successfully', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'تعذر النسخ مؤقتاً.' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'Retry worked' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<VoiceRecorder onInsert={vi.fn()} onKeepAudio={vi.fn()} />);
    await makeRecording(user);
    await user.click(screen.getByRole('button', { name: 'تحويل إلى نص' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر النسخ مؤقتاً');
    expect(screen.getByLabelText('حذف التسجيل')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'إعادة محاولة النسخ' }));
    expect(await screen.findByDisplayValue('Retry worked')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('explains microphone permission denial clearly', async () => {
    const user = userEvent.setup();
    navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    render(<VoiceRecorder onInsert={vi.fn()} onKeepAudio={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'بدء تسجيل جديد' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('تم رفض إذن الميكروفون'));
  });
});
