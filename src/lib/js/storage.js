import { apiFetch } from '$lib/utils/fetch-utils.js';

function queryFor(keepIds) {
	const query = new URLSearchParams();
	for (const id of keepIds) query.append('keep', id);
	return query.size ? `?${query}` : '';
}

export function getDisposableStorage(keepIds) {
	return apiFetch(`/api/storage${queryFor(keepIds)}`);
}

export function clearDisposableStorage(keepIds) {
	return apiFetch('/api/storage', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ keepIds })
	});
}
