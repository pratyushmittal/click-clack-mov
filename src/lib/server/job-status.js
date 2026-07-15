import { randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const statusQueues = new Map();

async function readStatus(jobDirectory) {
	try {
		return JSON.parse(await readFile(path.join(jobDirectory, 'status.json'), 'utf8'));
	} catch {
		return { events: [], contactSheets: {}, processingVideos: {} };
	}
}

function updateProcessingVideos(current, update) {
	// Most status updates do not change the active-video list.
	if (!update) return current;
	const videos = { ...current };

	// A video leaves the active list only after both artifacts are ready.
	if (update.done) delete videos[update.index];
	else videos[update.index] = { ...videos[update.index], ...update };
	return videos;
}

async function writeStatus(
	jobDirectory,
	{ intent = false, contactSheet, processingVideo, ...update }
) {
	const statusPath = path.join(jobDirectory, 'status.json');
	const temporaryPath = `${statusPath}.${randomUUID()}.tmp`;
	const current = await readStatus(jobDirectory);
	const updatedAt = new Date().toISOString();
	const status = {
		...current,
		...update,
		updatedAt,
		events: intent
			? [
					...(current.events || []),
					{ phase: update.phase || current.phase, message: update.message, createdAt: updatedAt }
				].slice(-50)
			: current.events || [],
		contactSheets: contactSheet
			? { ...(current.contactSheets || {}), [contactSheet.index]: contactSheet.url }
			: current.contactSheets || {},
		processingVideos: updateProcessingVideos(current.processingVideos || {}, processingVideo)
	};
	await writeFile(temporaryPath, JSON.stringify(status, null, 2));
	await rename(temporaryPath, statusPath);
}

export function updateJobStatus(jobDirectory, update) {
	// Keep later updates running even if an earlier status write failed.
	const previous = (statusQueues.get(jobDirectory) || Promise.resolve()).catch(() => {});
	const task = previous.then(() => writeStatus(jobDirectory, update));
	statusQueues.set(jobDirectory, task);
	return task.finally(() => {
		// A newer queued write owns cleanup when it exists.
		if (statusQueues.get(jobDirectory) === task) statusQueues.delete(jobDirectory);
	});
}
