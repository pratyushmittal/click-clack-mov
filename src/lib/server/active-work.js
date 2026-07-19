const activeWork = new Map();
let cleanup;

function retainActiveWork(id) {
	activeWork.set(id, (activeWork.get(id) || 0) + 1);
	return () => {
		const remaining = activeWork.get(id) - 1;
		if (remaining) activeWork.set(id, remaining);
		else activeWork.delete(id);
	};
}

export function trackActiveWork(id, work) {
	// New work waits so cleanup cannot remove its files between registration and first write.
	if (cleanup) return cleanup.then(() => trackActiveWork(id, work));

	const release = retainActiveWork(id);
	try {
		return Promise.resolve(work()).finally(release);
	} catch (err) {
		release();
		return Promise.reject(err);
	}
}

export async function trackStorageCleanup(work) {
	// Cleanup calls are serialized while new imports and jobs wait outside the deletion window.
	while (cleanup) await cleanup;

	let finish;
	cleanup = new Promise((resolve) => (finish = resolve));
	try {
		return await work([...activeWork.keys()]);
	} finally {
		cleanup = null;
		finish();
	}
}

export function getActiveWorkIds() {
	return [...activeWork.keys()];
}
