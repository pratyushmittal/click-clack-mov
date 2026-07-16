import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { createTranscriptionCache } from '../../src/lib/server/transcription-cache.js';

test('reuses a transcript for identical source bytes and model', async () => {
	const cacheDirectory = await mkdtemp(path.join(os.tmpdir(), 'vlogger-transcripts-'));
	const transcribe = createTranscriptionCache(cacheDirectory);
	let calls = 0;

	try {
		const createSegments = async () => {
			calls += 1;
			return [{ start: 0, end: 1, text: 'Hello' }];
		};
		const first = await transcribe('a'.repeat(64), 'whisper-1', createSegments);
		const second = await transcribe('a'.repeat(64), 'whisper-1', createSegments);

		expect(first.cached).toBe(false);
		expect(second.cached).toBe(true);
		expect(second.segments).toEqual(first.segments);
		expect(calls).toBe(1);
	} finally {
		await rm(cacheDirectory, { recursive: true, force: true });
	}
});

test('shares one in-flight transcription for duplicate files', async () => {
	const cacheDirectory = await mkdtemp(path.join(os.tmpdir(), 'vlogger-transcripts-'));
	const transcribe = createTranscriptionCache(cacheDirectory);
	let calls = 0;

	try {
		const createSegments = async () => {
			calls += 1;
			await new Promise((resolve) => setTimeout(resolve, 20));
			return [];
		};
		await Promise.all([
			transcribe('b'.repeat(64), 'whisper-1', createSegments),
			transcribe('b'.repeat(64), 'whisper-1', createSegments)
		]);

		expect(calls).toBe(1);
	} finally {
		await rm(cacheDirectory, { recursive: true, force: true });
	}
});
