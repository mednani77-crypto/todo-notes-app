import { env, pipeline } from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/whisper-tiny';
const LANGUAGE_NAMES = {
  ar: 'arabic',
  en: 'english',
  so: 'somali',
  am: 'amharic',
};

env.allowLocalModels = false;
env.useBrowserCache = true;
env.useWasmCache = true;

let transcriberPromise;

function progressValue(event) {
  const value = Number(event?.progress);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function getTranscriber(requestId) {
  if (!transcriberPromise) {
    transcriberPromise = pipeline('automatic-speech-recognition', MODEL_ID, {
      dtype: 'q8',
      progress_callback: (event) => {
        self.postMessage({
          type: 'progress',
          requestId,
          stage: 'loading-model',
          progress: progressValue(event),
        });
      },
    }).catch((error) => {
      transcriberPromise = undefined;
      throw error;
    });
  }
  return transcriberPromise;
}

self.addEventListener('message', async ({ data }) => {
  if (data?.type !== 'transcribe') return;
  const { requestId, audio, language } = data;

  try {
    const transcriber = await getTranscriber(requestId);
    self.postMessage({ type: 'progress', requestId, stage: 'transcribing', progress: null });
    const options = {
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    };
    if (LANGUAGE_NAMES[language]) options.language = LANGUAGE_NAMES[language];

    const result = await transcriber(audio, options);
    const text = result?.text?.trim();
    if (!text) throw new Error('لم يكتشف النموذج كلاماً واضحاً في التسجيل. قرّب الميكروفون وحاول مرة أخرى.');
    self.postMessage({ type: 'result', requestId, text });
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId,
      message: error?.message || 'تعذر نسخ التسجيل محلياً. التسجيل محفوظ لإعادة المحاولة.',
    });
  }
});
