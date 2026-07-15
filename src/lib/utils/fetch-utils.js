export async function apiFetch(url, options = {}) {
	const result = await fetch(url, options);
	const data = await result.json();

	if (!result.ok) {
		const err = new Error(data.error || 'Request failed');
		err.status = result.status;
		err.data = data;
		throw err;
	}

	return data;
}

export function apiPost(url, data) {
	const isFormData = data instanceof FormData;
	return apiFetch(url, {
		method: 'POST',
		headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
		body: isFormData ? data : JSON.stringify(data)
	});
}
