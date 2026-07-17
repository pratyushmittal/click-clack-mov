import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runEditorExportAgent } from '$lib/server/openai.js';
import finalCutProXmlReference from '$lib/server/references/final-cut-pro-7-xml.md?raw';

const jobsRoot = path.resolve('.vlogger/jobs');
const exports = new Map();

export function getEditorExportPath(id) {
	return path.join(jobsRoot, id, 'premiere-export.zip');
}

async function createEditorExport(id) {
	const jobDirectory = path.join(jobsRoot, id);
	await readFile(path.join(jobDirectory, 'result.json'), 'utf8');
	await writeFile(
		path.join(jobDirectory, 'premiere-xml-reference.md'),
		finalCutProXmlReference.trim()
	);
	const exported = await runEditorExportAgent(jobDirectory);
	await writeFile(
		path.join(jobDirectory, 'premiere-export.json'),
		JSON.stringify(exported, null, 2)
	);
	return exported;
}

export async function getOrCreateEditorExport(id) {
	try {
		await stat(getEditorExportPath(id));
		return;
	} catch {
		// The first export request asks the original editing conversation to build the project.
	}

	// Concurrent clicks should continue waiting on the same agent export.
	if (!exports.has(id)) {
		const task = createEditorExport(id).finally(() => exports.delete(id));
		exports.set(id, task);
	}
	await exports.get(id);
}
