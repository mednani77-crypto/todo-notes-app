import { describe, expect, it } from 'vitest';
import { mixAudioBufferToMono, resampleMonoAudio } from './localTranscription.js';

describe('local transcription audio preparation', () => {
  it('mixes stereo audio into one mono channel without clipping the samples', () => {
    const audioBuffer = {
      length: 3,
      numberOfChannels: 2,
      getChannelData: (channel) => channel === 0
        ? new Float32Array([1, 0.5, -1])
        : new Float32Array([-1, 0.5, 1]),
    };

    expect([...mixAudioBufferToMono(audioBuffer)]).toEqual([0, 0.5, 0]);
  });

  it('resamples browser audio to the 16 kHz input required by Whisper', () => {
    const source = new Float32Array(48_000).fill(0.25);
    const result = resampleMonoAudio(source, 48_000);

    expect(result).toHaveLength(16_000);
    expect(result[0]).toBeCloseTo(0.25);
    expect(result.at(-1)).toBeCloseTo(0.25);
  });

  it('returns an independent copy when audio is already 16 kHz', () => {
    const source = new Float32Array([0.1, 0.2, 0.3]);
    const result = resampleMonoAudio(source, 16_000);

    expect(result).not.toBe(source);
    expect([...result]).toEqual([...source]);
  });
});
