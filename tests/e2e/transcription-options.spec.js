import { expect, test } from '@playwright/test';
import { transcriptionOptions } from '../../src/lib/server/transcription-options.js';

test('uses server-side diarization for direct OpenAI transcription', () => {
	expect(transcriptionOptions('gpt-4o-transcribe-diarize')).toEqual({
		response_format: 'diarized_json',
		chunking_strategy: 'auto',
		temperature: 0
	});
});

test('requests segment timestamps from Whisper models', () => {
	expect(transcriptionOptions('openai/whisper-large-v3-turbo')).toEqual({
		response_format: 'verbose_json',
		timestamp_granularities: ['segment'],
		temperature: 0
	});
});

test('rejects transcription models without segment timestamps', () => {
	expect(() => transcriptionOptions('gpt-4o-transcribe')).toThrow(
		'does not provide segment timestamps'
	);
	expect(() => transcriptionOptions('openai/gpt-4o-mini-transcribe')).toThrow(
		'does not provide segment timestamps'
	);
});
