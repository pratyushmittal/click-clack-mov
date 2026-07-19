import { apiFetch, apiPost } from '$lib/utils/fetch-utils.js';

export function importMovieFile(importId, file) {
	return apiFetch(`/api/imports/${importId}?fileName=${encodeURIComponent(file.name)}`, {
		method: 'POST',
		headers: { 'Content-Type': file.type || 'application/octet-stream' },
		body: file
	});
}

export function startMoviePreprocessing(importId, file) {
	return apiPost('/api/preprocess', { importId, file });
}

export function getMovieStatus(jobId) {
	return apiFetch(`/api/jobs/${jobId}/status`);
}

export function createMovie({ importId, files, vibe, targetMinutes, onJob }) {
	onJob?.(importId);
	return apiPost('/api/create-movie', { importId, files, vibe, targetMinutes });
}

export function createEditorExport(jobId) {
	return apiPost(`/api/jobs/${jobId}/editor-export`, {});
}
