import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { createContactSheet, extractAudioChunks, getDuration } from '$lib/server/media.js';
import { transcribeVideo } from '$lib/server/openai.js';
import { getOrCreateContactSheet } from '$lib/server/contact-sheet-cache.js';
import { importedFilePath } from '$lib/server/imported-file.js';
import { createLogger } from '$lib/server/logger.js';

const logger = createLogger('Import/Preprocess');
const workRoot = path.resolve('.vlogger/preprocessing');
const tasks = new Map();
const queue = [];
let activeWorkers = 0;

function taskKey(importId, file) {
	return `${importId}/${file.storedName}`;
}

async function preprocessImportedVideo(importId, file) {
	const sourcePath = importedFilePath(importId, file.storedName);
	const workDirectory = path.join(workRoot, importId, file.storedName);
	const contactSheet = path.join(workDirectory, 'contact-sheet.jpg');
	const audioDirectory = path.join(workDirectory, 'audio');
	await mkdir(workDirectory, { recursive: true });

	try {
		const duration = await getDuration(sourcePath);
		const work = [
			getOrCreateContactSheet(file.sha256, contactSheet, (outputPath) =>
				createContactSheet(sourcePath, outputPath, duration)
			)
		];
		// Silent-footage experiments can skip paid transcription while retaining camera rolls.
		if (process.env.DISABLE_TRANSCRIPTION !== 'true') {
			work.push(transcribeVideo(file.sha256, () => extractAudioChunks(sourcePath, audioDirectory)));
		}
		const failed = (await Promise.allSettled(work)).find((result) => result.status === 'rejected');
		// Wait for both artifacts before cleanup, then let the normal pipeline retry the failure.
		if (failed) throw failed.reason;
		logger.info(`Prepared ${file.originalName} while waiting for the vibe`);
	} finally {
		await rm(workDirectory, { recursive: true, force: true });
	}
}

function runQueue() {
	const concurrency = Math.max(1, Math.min(Number(process.env.VIDEO_CONCURRENCY) || 2, 4));
	while (activeWorkers < concurrency && queue.length) {
		const item = queue.shift();
		activeWorkers += 1;
		void preprocessImportedVideo(item.importId, item.file)
			.then(item.resolve, item.reject)
			.finally(() => {
				activeWorkers -= 1;
				runQueue();
			});
	}
}

export function startImportedPreprocessing(importId, file) {
	const key = taskKey(importId, file);
	const current = tasks.get(key);
	// Repeated start requests should share the same queued or active work.
	if (current) return current;

	const task = new Promise((resolve, reject) => {
		queue.push({ importId, file, resolve, reject });
	}).finally(() => tasks.delete(key));
	tasks.set(key, task);
	runQueue();
	void task.catch((err) =>
		logger.error(`Could not prepare ${file.originalName}`, err?.message || err)
	);
	return task;
}

export function discardUnusedImportedPreprocessing(importId, files) {
	const selected = new Set(files.map((file) => taskKey(importId, file)));
	// Remove queued files backwards so deleting one entry does not shift the next index.
	for (let index = queue.length - 1; index >= 0; index -= 1) {
		const item = queue[index];
		if (item.importId !== importId || selected.has(taskKey(importId, item.file))) continue;
		queue.splice(index, 1);
		item.resolve();
	}
}

export function waitForImportPreprocessing(importId) {
	const prefix = `${importId}/`;
	return Promise.allSettled(
		[...tasks.entries()].filter(([key]) => key.startsWith(prefix)).map(([, task]) => task)
	);
}

export async function waitForImportedPreprocessing(importId, file) {
	const task = tasks.get(taskKey(importId, file));
	// A missing task has already finished or was never started, so the cache decides what remains.
	if (!task) return;
	try {
		await task;
	} catch {
		// The normal movie pipeline retries work that failed during speculative preprocessing.
	}
}
