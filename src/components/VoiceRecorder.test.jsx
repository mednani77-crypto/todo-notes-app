import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { transcribeAudioLocally } from '../lib/localTranscription.js';
import VoiceRecorder from './VoiceRecorder.jsx';

vi.mock('../lib/localTranscription.js', () => ({
  transcribeAudioLocally: vi.fn(),
}));

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
    vi.clearAllMocks();
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

  it('shows local model progress and inserts editable Arabic text at the cursor', async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    const onKeepAudio = vi.fn().mockResolvedValue('audio-id');
    transcribeAudioLocally.mockImplementation(async (_blob, language, onProgress) => {
      expect(language).toBe('auto');
      onProgress({ stage: 'loading-model', progress: 42 });
      onProgress({ stage: 'transcribing', progress: null });
      return 'نص عربي قابل للتحرير.';
    });

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

  it('keeps a failed recording and retries local transcription successfully', async () => {
    const user = userEvent.setup();
    transcribeAudioLocally
      .mockRejectedValueOnce(new Error('تعذر تشغيل النموذج محلياً.'))
      .mockResolvedValueOnce('نجحت إعادة المحاولة');

    render(<VoiceRecorder onInsert={vi.fn()} onKeepAudio={vi.fn()} />);
    await makeRecording(user);
    await user.click(screen.getByRole('button', { name: 'تحويل إلى نص' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر تشغيل النموذج محلياً');
    expect(screen.getByLabelText('حذف التسجيل')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'إعادة محاولة النسخ' }));
    expect(await screen.findByDisplayValue('نجحت إعادة المحاولة')).toBeInTheDocument();
    expect(transcribeAudioLocally).toHaveBeenCalledTimes(2);
  });

  it('explains microphone permission denial clearly', async () => {
    const user = userEvent.setup();
    navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    render(<VoiceRecorder onInsert={vi.fn()} onKeepAudio={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'بدء تسجيل جديد' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('تم رفض إذن الميكروفون'));
  });
});
