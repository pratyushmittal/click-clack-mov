import { apiFetch, apiPost } from '$lib/utils/fetch-utils.js';

async function importFile(importId, file) {
	return apiFetch(`/api/imports/${importId}?fileName=${encodeURIComponent(file.name)}`, {
		method: 'POST',
		headers: { 'Content-Type': file.type || 'application/octet-stream' },
		body: file
	});
}

export async function createMovie({ files, vibe, targetMinutes, onImport }) {
	const importId = crypto.randomUUID();
	const importedFiles = [];

	for (const [index, file] of files.entries()) {
		onImport?.(index, files.length, file.name);
		const result = await importFile(importId, file);
		importedFiles.push(result.file);
	}

	onImport?.(files.length, files.length, '');
	return apiPost('/api/create-movie', { importId, files: importedFiles, vibe, targetMinutes });
}
