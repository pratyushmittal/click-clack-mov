import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const cacheRoot = path.resolve('.vlogger/cache/transcriptions');
const cacheVersion = 1;

function cachePath(cacheDirectory, sourceHash, model) {
	const key = createHash('sha256').update(`${cacheVersion}\0${model}\0${sourceHash}`).digest('hex');
	return path.join(cacheDirectory, `${key}.json`);
}

async function readCachedSegments(cacheDirectory, sourceHash, model) {
	try {
		const data = JSON.parse(await readFile(cachePath(cacheDirectory, sourceHash, model), 'utf8'));

		// Old, corrupt, or mismatched entries should be regenerated safely.
		if (
			data.version !== cacheVersion ||
			data.sourceHash !== sourceHash ||
			data.model !== model ||
			!Array.isArray(data.segments)
		) {
			return null;
		}
		return data.segments;
	} catch {
		// A cache miss and a partially written cache are both safe to regenerate.
		return null;
	}
}

async function writeCachedSegments(cacheDirectory, sourceHash, model, segments) {
	await mkdir(cacheDirectory, { recursive: true });
	const outputPath = cachePath(cacheDirectory, sourceHash, model);
	const temporaryPath = `${outputPath}.${randomUUID()}.tmp`;
	await writeFile(
		temporaryPath,
		JSON.stringify({
			version: cacheVersion,
			createdAt: new Date().toISOString(),
			sourceHash,
			model,
			segments
		})
	);
	await rename(temporaryPath, outputPath);
}

export function createTranscriptionCache(cacheDirectory = cacheRoot) {
	const activeTranscriptions = new Map();

	return function getOrCreateTranscription(sourceHash, model, createSegments) {
		const key = `${model}\0${sourceHash}`;
		const active = activeTranscriptions.get(key);

		// Duplicate files in concurrent jobs should share the same transcription request.
		if (active) return active;

		const task = (async () => {
			const segments = await readCachedSegments(cacheDirectory, sourceHash, model);
			if (segments) return { segments, cached: true };

			const created = await createSegments();
			await writeCachedSegments(cacheDirectory, sourceHash, model, created);
			return { segments: created, cached: false };
		})();
		activeTranscriptions.set(key, task);
		return task.finally(() => {
			// A newer task may own the same key after this one completes.
			if (activeTranscriptions.get(key) === task) activeTranscriptions.delete(key);
		});
	};
}

export const getOrCreateTranscription = createTranscriptionCache();
