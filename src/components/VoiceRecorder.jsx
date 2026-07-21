import { useEffect, useRef, useState } from 'react';
import {
  CircleStop,
  Mic,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { AUDIO_LIMITS } from '../constants.js';
import { transcribeAudioLocally } from '../lib/localTranscription.js';
import { bytesLabel } from '../lib/noteUtils.js';

const STATE_LABELS = {
  idle: 'جاهز للتسجيل',
  requesting: 'بانتظار إذن الميكروفون…',
  recording: 'جارٍ التسجيل',
  paused: 'التسجيل متوقف مؤقتاً',
  ready: 'التسجيل جاهز للمعاينة',
  preparing: 'جارٍ تجهيز الصوت محلياً…',
  'loading-model': 'جارٍ تنزيل نموذج النسخ…',
  transcribing: 'جارٍ تحويل الصوت إلى نص…',
  completed: 'اكتمل النسخ',
  failed: 'فشل النسخ — التسجيل محفوظ',
};

function supportedMimeType() {
  const choices = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return choices.find((type) => globalThis.MediaRecorder?.isTypeSupported?.(type)) || '';
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export default function VoiceRecorder({ onInsert, onKeepAudio }) {
  const [status, setStatus] = useState('idle');
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [language, setLanguage] = useState('auto');
  const [keepAudio, setKeepAudio] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [modelProgress, setModelProgress] = useState(null);
  const [message, setMessage] = useState('');
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const savedAudioIdRef = useRef(null);

  useEffect(() => () => {
    window.clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  useEffect(() => {
    if (status !== 'recording') {
      window.clearInterval(intervalRef.current);
      return undefined;
    }
    intervalRef.current = window.setInterval(() => {
      setSeconds((current) => {
        if (current + 1 >= AUDIO_LIMITS.maxSeconds) {
          recorderRef.current?.stop();
          return AUDIO_LIMITS.maxSeconds;
        }
        return current + 1;
      });
    }, 1000);
    return () => window.clearInterval(intervalRef.current);
  }, [status]);

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      setStatus('failed');
      setMessage('التسجيل غير مدعوم في هذا المتصفح. استخدم Chrome أو Edge حديثاً.');
      return;
    }
    setMessage('');
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = supportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      setSeconds(0);
      setTranscript('');
      savedAudioIdRef.current = null;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setStatus('failed');
        setMessage('حدث خطأ أثناء التسجيل. تحقق من الميكروفون ثم حاول مرة أخرى.');
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) {
          setStatus('failed');
          setMessage('لم يحتوِ التسجيل على صوت قابل للحفظ.');
          return;
        }
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setStatus('ready');
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      setStatus('recording');
    } catch (error) {
      setStatus('failed');
      setMessage(error?.name === 'NotAllowedError'
        ? 'تم رفض إذن الميكروفون. اسمح بالوصول من إعدادات الموقع ثم أعد المحاولة.'
        : 'تعذر فتح الميكروفون. تأكد من عدم استخدامه في تطبيق آخر.');
    }
  }

  function pauseOrResume() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'recording') {
      recorder.pause();
      setStatus('paused');
    } else if (recorder.state === 'paused') {
      recorder.resume();
      setStatus('recording');
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }

  function clearRecording() {
    if (recorderRef.current?.state && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl('');
    setAudioBlob(null);
    setTranscript('');
    setModelProgress(null);
    setMessage('');
    setSeconds(0);
    setStatus('idle');
    savedAudioIdRef.current = null;
  }

  async function transcribe() {
    if (!audioBlob) return;
    if (audioBlob.size > AUDIO_LIMITS.maxBytes) {
      setStatus('failed');
      setMessage('حجم التسجيل أكبر من 20 MB. سجّل مقطعاً أقصر.');
      return;
    }
    setStatus('preparing');
    setModelProgress(null);
    setMessage('');
    try {
      const text = await transcribeAudioLocally(audioBlob, language, ({ stage, progress }) => {
        setStatus(stage);
        if (stage === 'loading-model' && progress !== null) setModelProgress(progress);
      });
      setTranscript(text);
      setStatus('completed');
      if (keepAudio && !savedAudioIdRef.current) {
        savedAudioIdRef.current = await onKeepAudio?.(audioBlob, seconds);
      }
    } catch (error) {
      setStatus('failed');
      setMessage(error.message || 'تعذر نسخ التسجيل. احتفظنا به لتتمكن من إعادة المحاولة.');
    }
  }

  async function insertTranscript(mode) {
    if (!transcript.trim()) return;
    if (keepAudio && !savedAudioIdRef.current) savedAudioIdRef.current = await onKeepAudio?.(audioBlob, seconds);
    onInsert(transcript.trim(), mode);
    if (!keepAudio) clearRecording();
  }

  const busy = ['preparing', 'loading-model', 'transcribing'].includes(status);
  const canRecord = ['idle', 'failed'].includes(status) && !audioBlob;

  return (
    <section className="voice-recorder" aria-labelledby="voice-title">
      <div className="voice-heading">
        <div>
          <span className={`recording-indicator is-${status}`} aria-hidden="true" />
          <h3 id="voice-title">التسجيل والنسخ الصوتي</h3>
          <p role="status">{STATE_LABELS[status]} {seconds > 0 && `· ${formatDuration(seconds)}`}</p>
        </div>
        {audioBlob && <span className="file-size">{bytesLabel(audioBlob.size)}</span>}
      </div>

      {canRecord && (
        <button className="record-primary" type="button" onClick={startRecording}><Mic /> بدء تسجيل جديد</button>
      )}
      {(status === 'recording' || status === 'paused') && (
        <div className="recording-controls">
          <button type="button" onClick={pauseOrResume}>{status === 'paused' ? <Play /> : <Pause />}{status === 'paused' ? 'متابعة' : 'إيقاف مؤقت'}</button>
          <button type="button" className="stop-recording" onClick={stopRecording}><CircleStop /> إيقاف</button>
        </div>
      )}

      {audioUrl && (
        <div className="recording-preview">
          <audio controls preload="metadata" src={audioUrl}>متصفحك لا يدعم تشغيل التسجيل.</audio>
          <button type="button" className="icon-only danger" onClick={clearRecording} aria-label="حذف التسجيل"><Trash2 /></button>
        </div>
      )}

      {audioBlob && status !== 'completed' && (
        <div className="transcription-options">
          <label>لغة التسجيل
            <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={busy}>
              <option value="auto">اكتشاف تلقائي</option>
              <option value="ar">العربية</option>
              <option value="en">English</option>
              <option value="so">Soomaali</option>
              <option value="am">አማርኛ</option>
            </select>
          </label>
          <label className="check-label"><input type="checkbox" checked={keepAudio} onChange={(event) => setKeepAudio(event.target.checked)} /> الاحتفاظ بالتسجيل بعد النسخ</label>
          <p className="privacy-note">النسخ مجاني ويجري على جهازك؛ لا يُرفع التسجيل إلى خادم. تُنزّل ملفات نموذج Whisper من Hugging Face عند أول استخدام ثم يحفظها المتصفح مؤقتاً.</p>
          {status === 'loading-model' && modelProgress !== null && (
            <div className="model-progress" aria-label={`تنزيل نموذج النسخ ${modelProgress}%`}>
              <progress max="100" value={modelProgress} />
              <span>{modelProgress}%</span>
            </div>
          )}
          <button className="transcribe-button" type="button" onClick={transcribe} disabled={busy}>
            {busy ? <RefreshCw className="spin" /> : status === 'failed' ? <RotateCcw /> : <Mic />}
            {busy ? STATE_LABELS[status] : status === 'failed' ? 'إعادة محاولة النسخ' : 'تحويل إلى نص'}
          </button>
        </div>
      )}

      {status === 'completed' && (
        <div className="transcript-result">
          <label htmlFor="transcript-text">النص الناتج — يمكنك تعديله قبل الإدراج</label>
          <textarea id="transcript-text" value={transcript} onChange={(event) => setTranscript(event.target.value)} rows="5" dir="auto" />
          <div className="transcript-actions">
            <button type="button" onClick={() => insertTranscript('cursor')}>إدراج عند المؤشر</button>
            <button type="button" onClick={() => insertTranscript('section')}>إضافة كقسم مستقل</button>
          </div>
        </div>
      )}

      {message && <p className="inline-error" role="alert">{message}</p>}
      <p className="voice-limits">الحد الأقصى: 5 دقائق أو 20 MB. العربية والإنجليزية مدعومتان؛ تتفاوت دقة الصومالية والأمهرية حسب وضوح الصوت والجهاز. يلزم الإنترنت لتنزيل النموذج في المرة الأولى.</p>
    </section>
  );
}
