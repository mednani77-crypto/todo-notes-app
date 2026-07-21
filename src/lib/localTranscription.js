const TARGET_SAMPLE_RATE = 16_000;

let worker;
let requestSequence = 0;
const pendingRequests = new Map();

function friendlyError(error) {
  if (!navigator.onLine) {
    return 'يلزم الاتصال بالإنترنت لتنزيل نموذج النسخ في المرة الأولى. التسجيل محفوظ ويمكنك إعادة المحاولة لاحقاً.';
  }
  if (error?.message?.includes('Worker')) {
    return 'هذا المتصفح لا يدعم النسخ المحلي. جرّب إصداراً حديثاً من Chrome أو Edge.';
  }
  return error?.message || 'تعذر تشغيل النسخ المحلي. التسجيل محفوظ ويمكنك إعادة المحاولة.';
}
function rejectAll(error) {
  for (const request of pendingRequests.values()) request.reject(new Error(friendlyError(error)));
  pendingRequests.clear();
  worker?.terminate();
  worker = undefined;
}

function getWorker() {
  if (worker) return worker;
  if (typeof Worker === 'undefined') throw new Error('Worker API is unavailable');

  worker = new Worker(new URL('../workers/transcription.worker.js', import.meta.url), { type: 'module' });
  worker.addEventListener('message', ({ data }) => {
    const request = pendingRequests.get(data.requestId);
    if (!request) return;

    if (data.type === 'progress') {
      request.onProgress?.({ stage: data.stage, progress: data.progress });
      return;
    }

    pendingRequests.delete(data.requestId);
    if (data.type === 'result') request.resolve(data.text);
    else request.reject(new Error(data.message || 'تعذر نسخ التسجيل محلياً.'));
  });
  worker.addEventListener('error', rejectAll);
  worker.addEventListener('messageerror', rejectAll);
  return worker;
}

export function resampleMonoAudio(samples, inputSampleRate, outputSampleRate = TARGET_SAMPLE_RATE) {
  if (inputSampleRate === outputSampleRate) return new Float32Array(samples);
  const outputLength = Math.max(1, Math.round(samples.length * outputSampleRate / inputSampleRate));
  const output = new Float32Array(outputLength);
  const ratio = inputSampleRate / outputSampleRate;

  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const before = Math.floor(position);
    const after = Math.min(before + 1, samples.length - 1);
    const weight = position - before;
    output[index] = samples[before] * (1 - weight) + samples[after] * weight;
  }
  return output;
}

export function mixAudioBufferToMono(audioBuffer) {
  const mono = new Float32Array(audioBuffer.length);
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const data = audioBuffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) mono[index] += data[index] / audioBuffer.numberOfChannels;
  }
  return mono;
}

export async function decodeAudioBlob(audioBlob) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) throw new Error('تعذر قراءة التسجيل في هذا المتصفح. جرّب Chrome أو Edge حديثاً.');

  const context = new AudioContextClass();
  try {
    const audioBuffer = await context.decodeAudioData(await audioBlob.arrayBuffer());
    return resampleMonoAudio(mixAudioBufferToMono(audioBuffer), audioBuffer.sampleRate);
  } catch {
    throw new Error('تعذر فك ترميز التسجيل. احتفظنا به؛ جرّب تسجيلاً أقصر أو متصفحاً آخر.');
  } finally {
    await context.close?.().catch?.(() => {});
  }
}

export async function transcribeAudioLocally(audioBlob, language = 'auto', onProgress) {
  onProgress?.({ stage: 'preparing', progress: 0 });
  const audio = await decodeAudioBlob(audioBlob);
  const requestId = `transcription-${Date.now()}-${requestSequence += 1}`;

  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject, onProgress });
    try {
      getWorker().postMessage({ type: 'transcribe', requestId, audio, language }, [audio.buffer]);
    } catch (error) {
      pendingRequests.delete(requestId);
      reject(new Error(friendlyError(error)));
    }
  });
}
