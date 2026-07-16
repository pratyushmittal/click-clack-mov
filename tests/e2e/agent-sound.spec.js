import { mkdtemp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { downloadAgentSound } from '../../src/lib/server/agent-sound.js';

function silentWav(seconds = 1) {
	const sampleRate = 8000;
	const dataSize = sampleRate * seconds * 2;
	const wav = Buffer.alloc(44 + dataSize);
	wav.write('RIFF', 0);
	wav.writeUInt32LE(36 + dataSize, 4);
	wav.write('WAVEfmt ', 8);
	wav.writeUInt32LE(16, 16);
	wav.writeUInt16LE(1, 20);
	wav.writeUInt16LE(1, 22);
	wav.writeUInt32LE(sampleRate, 24);
	wav.writeUInt32LE(sampleRate * 2, 28);
	wav.writeUInt16LE(2, 32);
	wav.writeUInt16LE(16, 34);
	wav.write('data', 36);
	wav.writeUInt32LE(dataSize, 40);
	return wav;
}

function openverseResult(overrides = {}) {
	return {
		id: '12345678-1234-1234-1234-123456789abc',
		title: 'Soft Whoosh',
		foreign_landing_url: 'https://commons.wikimedia.org/wiki/File:Soft_whoosh.wav',
		url: 'https://upload.wikimedia.org/soft-whoosh.wav',
		creator: 'Sound Artist',
		license: 'cc0',
		license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
		provider: 'wikimedia',
		source: 'wikimedia',
		filesize: 16044,
		filetype: 'wav',
		duration: 1000,
		mature: false,
		attribution: '"Soft Whoosh" by Sound Artist is marked with CC0 1.0.',
		...overrides
	};
}

test('downloads, validates, caches, and records a CC0 sound effect', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'vlogger-sound-'));
	const firstJob = path.join(root, 'job-one');
	const secondJob = path.join(root, 'job-two');
	const cacheDirectory = path.join(root, 'cache');
	const wav = silentWav();
	let audioDownloads = 0;
	await Promise.all([mkdir(firstJob), mkdir(secondJob)]);

	const fetcher = async (input) => {
		const url = new URL(input);
		if (url.hostname === 'api.openverse.org') {
			return new Response(JSON.stringify({ results: [openverseResult()] }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			});
		}

		audioDownloads += 1;
		return new Response(wav, {
			status: 200,
			headers: { 'content-type': 'audio/wav', 'content-length': String(wav.length) }
		});
	};

	try {
		const first = await downloadAgentSound(
			{ query: 'soft cinematic whoosh', maxDurationSeconds: 3 },
			firstJob,
			{ fetcher, cacheDirectory }
		);
		const second = await downloadAgentSound(
			{ query: 'soft cinematic whoosh', maxDurationSeconds: 3 },
			secondJob,
			{ fetcher, cacheDirectory }
		);

		expect(first.path).toMatch(/^\.\/downloaded-audio\/soft-whoosh-/);
		expect(first.license).toBe('CC0-1.0');
		expect(first.duration).toBeCloseTo(1, 1);
		expect(second.sourceId).toBe(first.sourceId);
		expect(audioDownloads).toBe(1);
		expect((await stat(path.join(firstJob, first.path))).isFile()).toBe(true);
		expect(JSON.parse(await readFile(path.join(firstJob, 'audio-credits.json'), 'utf8'))).toEqual([
			first
		]);
		expect(await readFile(path.join(firstJob, 'audio-credits.txt'), 'utf8')).toContain(
			'Soft Whoosh'
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('does not download results without an approved CC0 audio URL', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'vlogger-sound-'));
	const jobDirectory = path.join(root, 'job');
	await mkdir(jobDirectory);
	const fetcher = async () =>
		new Response(
			JSON.stringify({
				results: [
					openverseResult({ license: 'by' }),
					openverseResult({ id: 'other-id', url: 'https://example.com/sound.wav' })
				]
			}),
			{ status: 200, headers: { 'content-type': 'application/json' } }
		);

	try {
		await expect(
			downloadAgentSound({ query: 'impact', maxDurationSeconds: 3 }, jobDirectory, {
				fetcher,
				cacheDirectory: path.join(root, 'cache')
			})
		).rejects.toThrow('No suitable CC0 sound effect was found');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('limits each movie to three unique downloaded effects', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'vlogger-sound-'));
	const jobDirectory = path.join(root, 'job');
	const cacheDirectory = path.join(root, 'cache');
	const wav = silentWav();
	let audioDownloads = 0;
	await mkdir(jobDirectory);

	const fetcher = async (input) => {
		const url = new URL(input);
		if (url.hostname === 'api.openverse.org') {
			const query = url.searchParams.get('q');
			const index = ['one', 'two', 'three', 'four'].indexOf(query) + 1;
			return new Response(
				JSON.stringify({
					results: [
						openverseResult({
							id: `${index}2345678-1234-1234-1234-123456789abc`,
							title: `Effect ${index}`,
							url: `https://upload.wikimedia.org/effect-${index}.wav`
						})
					]
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			);
		}

		audioDownloads += 1;
		return new Response(wav, {
			status: 200,
			headers: { 'content-type': 'audio/wav' }
		});
	};

	try {
		for (const query of ['one', 'two', 'three']) {
			await downloadAgentSound({ query, maxDurationSeconds: 3 }, jobDirectory, {
				fetcher,
				cacheDirectory
			});
		}

		await expect(
			downloadAgentSound({ query: 'four', maxDurationSeconds: 3 }, jobDirectory, {
				fetcher,
				cacheDirectory
			})
		).rejects.toThrow('already has three downloaded sounds');
		expect(audioDownloads).toBe(3);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
