// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

describe('transcription gateway', () => {
  it('reports configuration health without exposing a secret', async () => {
    const response = await request(createApp({ environment: { OPENAI_API_KEY: 'secret-value' } })).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, transcriptionConfigured: true });
    expect(response.text).not.toContain('secret-value');
  });

  it('validates audio, sends it to the provider from the server, and returns Arabic text', async () => {
    const providerFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'مرحباً بالعالم.', language: 'ar' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const app = createApp({
      environment: { OPENAI_API_KEY: 'server-only-key', OPENAI_TRANSCRIBE_MODEL: 'gpt-4o-mini-transcribe' },
      fetch: providerFetch,
    });

    const response = await request(app)
      .post('/api/transcriptions')
      .field('language', 'ar')
      .attach('audio', Buffer.from('valid-audio'), { filename: 'note.webm', contentType: 'audio/webm' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ text: 'مرحباً بالعالم.', language: 'ar' });
    expect(providerFetch).toHaveBeenCalledOnce();
    const [, requestOptions] = providerFetch.mock.calls[0];
    expect(requestOptions.headers.Authorization).toBe('Bearer server-only-key');
    expect(requestOptions.body.get('language')).toBe('ar');
    expect(requestOptions.body.get('model')).toBe('gpt-4o-mini-transcribe');
  });

  it('fails gracefully when credentials are unavailable', async () => {
    const providerFetch = vi.fn();
    const response = await request(createApp({ environment: {}, fetch: providerFetch }))
      .post('/api/transcriptions')
      .attach('audio', Buffer.from('audio'), { filename: 'note.webm', contentType: 'audio/webm' });
    expect(response.status).toBe(503);
    expect(response.body.error).toBe('transcription_unavailable');
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('maps provider failure to a retryable response without echoing provider details', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const providerFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'private provider detail' } }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    }));
    const response = await request(createApp({ environment: { OPENAI_API_KEY: 'key' }, fetch: providerFetch }))
      .post('/api/transcriptions')
      .attach('audio', Buffer.from('audio'), { filename: 'note.webm', contentType: 'audio/webm' });
    expect(response.status).toBe(502);
    expect(response.body.error).toBe('transcription_failed');
    expect(response.text).not.toContain('private provider detail');
  });

  it('rejects unsupported audio types and oversized uploads', async () => {
    const unsupported = await request(createApp({ environment: { OPENAI_API_KEY: 'key' } }))
      .post('/api/transcriptions')
      .attach('audio', Buffer.from('text'), { filename: 'note.txt', contentType: 'text/plain' });
    expect(unsupported.status).toBe(415);

    const oversized = await request(createApp({ environment: { OPENAI_API_KEY: 'key', MAX_AUDIO_BYTES: '4' } }))
      .post('/api/transcriptions')
      .attach('audio', Buffer.from('12345'), { filename: 'note.webm', contentType: 'audio/webm' });
    expect(oversized.status).toBe(413);
  });
});
