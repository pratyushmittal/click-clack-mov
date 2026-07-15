import { randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function readStatus(jobDirectory) {
	try {
		return JSON.parse(await readFile(path.join(jobDirectory, 'status.json'), 'utf8'));
	} catch {
		return { events: [] };
	}
}

export async function updateJobStatus(jobDirectory, { phase, message, intent = false }) {
	const statusPath = path.join(jobDirectory, 'status.json');
	const temporaryPath = `${statusPath}.${randomUUID()}.tmp`;
	const current = await readStatus(jobDirectory);
	const event = { phase, message, createdAt: new Date().toISOString() };
	const status = {
		phase,
		message,
		updatedAt: event.createdAt,
		events: intent ? [...current.events, event].slice(-50) : current.events
	};
	await writeFile(temporaryPath, JSON.stringify(status, null, 2));
	await rename(temporaryPath, statusPath);
}
