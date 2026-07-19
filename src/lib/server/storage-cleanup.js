import { lstat, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const HISTORY_FILE = 'agent-history.jsonl';

async function readEntries(directory) {
	try {
		return await readdir(directory, { withFileTypes: true });
	} catch (err) {
		// Storage folders are created lazily and may not exist on a fresh install.
		if (err.code === 'ENOENT') return [];
		throw err;
	}
}

async function entryBytes(filePath) {
	try {
		const info = await lstat(filePath);
		if (!info.isDirectory()) return info.size;

		let bytes = 0;
		for (const entry of await readEntries(filePath)) {
			bytes += await entryBytes(path.join(filePath, entry.name));
		}
		return bytes;
	} catch (err) {
		// A concurrent preprocessing task may remove temporary output while it is counted.
		if (err.code === 'ENOENT') return 0;
		throw err;
	}
}

async function disposableEntries(directory, keepNames = new Set()) {
	return (await readEntries(directory)).filter((entry) => !keepNames.has(entry.name));
}

async function entriesBytes(directory, keepNames) {
	let bytes = 0;
	for (const entry of await disposableEntries(directory, keepNames)) {
		bytes += await entryBytes(path.join(directory, entry.name));
	}
	return bytes;
}

async function removeEntries(directory, keepNames) {
	let removedBytes = 0;
	for (const entry of await disposableEntries(directory, keepNames)) {
		const filePath = path.join(directory, entry.name);
		removedBytes += await entryBytes(filePath);
		await rm(filePath, { recursive: true, force: true });
	}
	return removedBytes;
}

async function jobBytes(jobsRoot, keepIds) {
	let bytes = 0;
	for (const job of await disposableEntries(jobsRoot, keepIds)) {
		const jobPath = path.join(jobsRoot, job.name);
		bytes += job.isDirectory()
			? await entriesBytes(jobPath, new Set([HISTORY_FILE]))
			: await entryBytes(jobPath);
	}
	return bytes;
}

async function clearJobs(jobsRoot, keepIds) {
	let removedBytes = 0;
	for (const job of await disposableEntries(jobsRoot, keepIds)) {
		const jobPath = path.join(jobsRoot, job.name);
		if (job.isDirectory()) {
			removedBytes += await removeEntries(jobPath, new Set([HISTORY_FILE]));
			// Remove empty job shells only when there is no history left to preserve.
			if (!(await readEntries(jobPath)).length) await rm(jobPath, { recursive: true, force: true });
		} else {
			removedBytes += await entryBytes(jobPath);
			await rm(jobPath, { force: true });
		}
	}
	return removedBytes;
}

export function createStorageCleanup(root = path.resolve('.vlogger')) {
	const jobsRoot = path.join(root, 'jobs');
	const disposableRoots = ['imports', 'preprocessing', 'uploads'].map((name) =>
		path.join(root, name)
	);

	return {
		async inspect(keepIds = []) {
			const keepNames = new Set(keepIds);
			let bytes = await jobBytes(jobsRoot, keepNames);
			for (const directory of disposableRoots) bytes += await entriesBytes(directory, keepNames);
			return { bytes };
		},

		async clear(keepIds = []) {
			const keepNames = new Set(keepIds);
			let removedBytes = await clearJobs(jobsRoot, keepNames);
			for (const directory of disposableRoots) {
				removedBytes += await removeEntries(directory, keepNames);
			}
			return { removedBytes };
		}
	};
}

export const storageCleanup = createStorageCleanup();
