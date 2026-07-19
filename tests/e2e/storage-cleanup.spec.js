import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
	getActiveWorkIds,
	trackActiveWork,
	trackStorageCleanup
} from '../../src/lib/server/active-work.js';
import { createStorageCleanup } from '../../src/lib/server/storage-cleanup.js';

async function addFile(root, fileName, size) {
	const filePath = path.join(root, fileName);
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, Buffer.alloc(size));
	return filePath;
}

async function exists(filePath) {
	try {
		await stat(filePath);
		return true;
	} catch (err) {
		// Tests use missing files to verify that cleanup removed only disposable data.
		if (err.code === 'ENOENT') return false;
		throw err;
	}
}

test('clears processed files but preserves caches, histories, and current work', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'click-clack-storage-'));

	try {
		const cleanup = createStorageCleanup(root);
		const history = await addFile(root, 'jobs/stale/agent-history.jsonl', 7);
		const jobVideo = await addFile(root, 'jobs/stale/vlogger-cut.mp4', 11);
		const jobFrame = await addFile(root, 'jobs/stale/frames/frame.jpg', 13);
		const currentJob = await addFile(root, 'jobs/current/vlogger-cut.mp4', 17);
		const staleImport = await addFile(root, 'imports/stale/source.mov', 19);
		const currentImport = await addFile(root, 'imports/current/source.mov', 23);
		const preprocessing = await addFile(root, 'preprocessing/stale/audio.m4a', 29);
		const upload = await addFile(root, 'uploads/legacy.mov', 31);
		const transcript = await addFile(root, 'cache/transcriptions/source.json', 37);
		const contactSheet = await addFile(root, 'cache/contact-sheets/source.jpg', 41);

		await expect(cleanup.inspect(['current'])).resolves.toEqual({ bytes: 103 });
		await expect(cleanup.clear(['current'])).resolves.toEqual({ removedBytes: 103 });
		await expect(cleanup.inspect(['current'])).resolves.toEqual({ bytes: 0 });

		expect(await readFile(history)).toHaveLength(7);
		expect(await readFile(currentJob)).toHaveLength(17);
		expect(await readFile(currentImport)).toHaveLength(23);
		expect(await readFile(transcript)).toHaveLength(37);
		expect(await readFile(contactSheet)).toHaveLength(41);
		expect(await exists(jobVideo)).toBe(false);
		expect(await exists(jobFrame)).toBe(false);
		expect(await exists(staleImport)).toBe(false);
		expect(await exists(preprocessing)).toBe(false);
		expect(await exists(upload)).toBe(false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('keeps an ID protected until all of its active work finishes', async () => {
	let finishFirst;
	let finishSecond;
	const first = trackActiveWork('current', () => new Promise((resolve) => (finishFirst = resolve)));
	const second = trackActiveWork(
		'current',
		() => new Promise((resolve) => (finishSecond = resolve))
	);

	expect(getActiveWorkIds()).toEqual(['current']);
	finishFirst();
	await first;
	expect(getActiveWorkIds()).toEqual(['current']);
	finishSecond();
	await second;
	expect(getActiveWorkIds()).toEqual([]);
});

test('holds new work until storage cleanup finishes', async () => {
	let finishCleanup;
	let started = false;
	const cleanup = trackStorageCleanup(() => new Promise((resolve) => (finishCleanup = resolve)));
	const work = trackActiveWork('new-work', () => (started = true));

	expect(started).toBe(false);
	finishCleanup();
	await cleanup;
	await work;
	expect(started).toBe(true);
	expect(getActiveWorkIds()).toEqual([]);
});

test('shows and clears the processed storage indicator', async ({ page }) => {
	const cleared = [];
	await page.route('**/api/storage*', async (route) => {
		if (route.request().method() === 'DELETE') {
			cleared.push(route.request().postDataJSON());
			await route.fulfill({ json: { success: true, removedBytes: 1.5 * 1024 ** 3, bytes: 0 } });
			return;
		}
		await route.fulfill({ json: { success: true, bytes: 1.5 * 1024 ** 3 } });
	});
	page.on('dialog', (dialog) => dialog.accept());

	await page.goto('/');
	const button = page.getByRole('button', { name: 'Clear 1.5 GB of processed files' });
	await expect(button).toBeVisible();
	await button.click();

	await expect.poll(() => cleared).toEqual([{ keepIds: [] }]);
	await expect(button).toHaveCount(0);
});
