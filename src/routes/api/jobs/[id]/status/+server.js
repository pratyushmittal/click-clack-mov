import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { apiError, apiSuccess } from '$lib/server/api-response.js';

const jobsRoot = path.resolve('.vlogger/jobs');

export async function GET({ params }) {
	if (!/^[a-f0-9-]{36}$/.test(params.id)) return apiError('Job not found', 404);

	try {
		const status = JSON.parse(
			await readFile(path.join(jobsRoot, params.id, 'status.json'), 'utf8')
		);
		return apiSuccess({ status });
	} catch {
		return apiError('Job status is not available yet', 404);
	}
}
