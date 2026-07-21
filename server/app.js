import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';

const directory = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIRECTORY = path.resolve(directory, '..', 'dist');
const DEFAULT_MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const ALLOWED_LANGUAGES = new Set(['auto', 'ar', 'en', 'so', 'am']);
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'video/webm',
]);

function extensionForType(type) {
  const extensions = {
    'audio/webm': 'webm',
    'video/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
  };
  return extensions[type] || 'webm';
}

export function createApp(options = {}) {
  const environment = options.environment || process.env;
  const requestFetch = options.fetch || globalThis.fetch;
  const app = express();
  const maxAudioBytes = Number(environment.MAX_AUDIO_BYTES) || DEFAULT_MAX_AUDIO_BYTES;
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { files: 1, fileSize: maxAudioBytes, fields: 4 },
    fileFilter: (_request, file, callback) => {
      if (!ALLOWED_AUDIO_TYPES.has(file.mimetype)) {
        callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'audio'));
        return;
      }
      callback(null, true);
    },
  });

  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        workerSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.get('/api/health', (_request, response) => {
    response.set('Cache-Control', 'no-store').json({
      ok: true,
      transcriptionConfigured: Boolean(environment.OPENAI_API_KEY),
    });
  });

  const transcriptionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'rate_limited', message: 'تم تجاوز عدد محاولات النسخ المسموح به مؤقتاً.' },
  });

  app.post('/api/transcriptions', transcriptionLimiter, (request, response, next) => {
    upload.single('audio')(request, response, (error) => {
      if (error) {
        const tooLarge = error.code === 'LIMIT_FILE_SIZE';
        response.status(tooLarge ? 413 : 415).json({
          error: tooLarge ? 'audio_too_large' : 'unsupported_audio',
          message: tooLarge ? 'حجم التسجيل أكبر من الحد المسموح.' : 'نوع ملف التسجيل غير مدعوم.',
        });
        return;
      }
      next();
    });
  }, async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (!environment.OPENAI_API_KEY) {
      response.status(503).json({
        error: 'transcription_unavailable',
        message: 'خدمة تحويل الصوت غير مهيأة على الخادم. أضف OPENAI_API_KEY في إعدادات Render.',
      });
      return;
    }
    if (!request.file?.buffer?.length) {
      response.status(400).json({ error: 'audio_required', message: 'لم يتم إرفاق تسجيل صوتي.' });
      return;
    }

    const language = ALLOWED_LANGUAGES.has(request.body.language) ? request.body.language : 'auto';
    const form = new FormData();
    const audioBlob = new Blob([request.file.buffer], { type: request.file.mimetype });
    form.append('file', audioBlob, `recording.${extensionForType(request.file.mimetype)}`);
    form.append('model', environment.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe');
    form.append('response_format', 'json');
    if (language !== 'auto') form.append('language', language);

    try {
      const providerResponse = await requestFetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${environment.OPENAI_API_KEY}` },
        body: form,
        signal: AbortSignal.timeout(Number(environment.TRANSCRIPTION_TIMEOUT_MS) || 120000),
      });
      const payload = await providerResponse.json().catch(() => ({}));
      if (!providerResponse.ok || typeof payload.text !== 'string') {
        console.warn('Transcription provider request failed.', { status: providerResponse.status });
        response.status(providerResponse.status === 429 ? 429 : 502).json({
          error: providerResponse.status === 429 ? 'provider_rate_limited' : 'transcription_failed',
          message: providerResponse.status === 429
            ? 'خدمة النسخ مشغولة حالياً. احتفظنا بالتسجيل ويمكنك المحاولة لاحقاً.'
            : 'تعذر نسخ التسجيل. احتفظنا بالتسجيل لتتمكن من إعادة المحاولة.',
        });
        return;
      }
      response.json({ text: payload.text.trim(), language: payload.language || language });
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      console.warn('Transcription request could not complete.', { reason: timedOut ? 'timeout' : 'network' });
      response.status(504).json({
        error: timedOut ? 'transcription_timeout' : 'transcription_failed',
        message: 'لم يكتمل النسخ. التسجيل ما زال محفوظاً ويمكنك إعادة المحاولة.',
      });
    }
  });

  app.use('/assets', express.static(path.join(DIST_DIRECTORY, 'assets'), {
    immutable: true,
    maxAge: '1y',
  }));
  app.use(express.static(DIST_DIRECTORY, { maxAge: '1h', index: false }));
  app.use((request, response, next) => {
    if (request.method === 'GET' && request.accepts('html')) {
      response.set('Cache-Control', 'no-cache').sendFile(path.join(DIST_DIRECTORY, 'index.html'));
      return;
    }
    next();
  });

  return app;
}
