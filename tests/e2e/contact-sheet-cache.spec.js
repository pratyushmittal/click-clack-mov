import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { createContactSheetCache } from '../../src/lib/server/contact-sheet-cache.js';

test('reuses a camera roll for identical source bytes', async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'vlogger-camera-rolls-'));
	const cache = createContactSheetCache(path.join(directory, 'cache'));
	let calls = 0;

	try {
		const createSheet = async (outputPath) => {
			calls += 1;
			await writeFile(outputPath, 'camera roll');
		};
		const firstPath = path.join(directory, 'first.jpg');
		const secondPath = path.join(directory, 'second.jpg');
		const first = await cache('a'.repeat(64), firstPath, createSheet);
		const second = await cache('a'.repeat(64), secondPath, createSheet);

		expect(first.cached).toBe(false);
		expect(second.cached).toBe(true);
		expect(await readFile(secondPath, 'utf8')).toBe('camera roll');
		expect(calls).toBe(1);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('shares one in-flight camera roll for duplicate files', async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'vlogger-camera-rolls-'));
	const cache = createContactSheetCache(path.join(directory, 'cache'));
	let calls = 0;

	try {
		const createSheet = async (outputPath) => {
			calls += 1;
			await new Promise((resolve) => setTimeout(resolve, 20));
			await writeFile(outputPath, 'camera roll');
		};
		await Promise.all([
			cache('b'.repeat(64), path.join(directory, 'first.jpg'), createSheet),
			cache('b'.repeat(64), path.join(directory, 'second.jpg'), createSheet)
		]);

		expect(calls).toBe(1);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
