import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const cacheRoot = path.resolve('.vlogger/cache/contact-sheets');
const cacheVersion = 1;

function cachePath(cacheDirectory, sourceHash) {
	return path.join(cacheDirectory, `${cacheVersion}-${sourceHash}.jpg`);
}

async function hasCachedSheet(filePath) {
	try {
		return (await stat(filePath)).size > 0;
	} catch {
		// Missing or unreadable cache entries are safe to regenerate.
		return false;
	}
}

export function createContactSheetCache(cacheDirectory = cacheRoot) {
	const activeSheets = new Map();

	return async function getOrCreateContactSheet(sourceHash, outputPath, createSheet) {
		const cachedPath = cachePath(cacheDirectory, sourceHash);
		let task = activeSheets.get(sourceHash);

		// Duplicate files in concurrent jobs should share the same FFmpeg work.
		if (!task) {
			task = (async () => {
				if (await hasCachedSheet(cachedPath)) return true;

				await mkdir(cacheDirectory, { recursive: true });
				const temporaryPath = `${cachedPath}.${randomUUID()}.tmp.jpg`;
				try {
					await createSheet(temporaryPath);
					await rename(temporaryPath, cachedPath);
					return false;
				} finally {
					await rm(temporaryPath, { force: true });
				}
			})();
			activeSheets.set(sourceHash, task);
		}

		try {
			const cached = await task;
			await copyFile(cachedPath, outputPath, constants.COPYFILE_FICLONE);
			return { cached };
		} finally {
			// A newer task may own the same source after this one completes.
			if (activeSheets.get(sourceHash) === task) activeSheets.delete(sourceHash);
		}
	};
}

export const getOrCreateContactSheet = createContactSheetCache();
