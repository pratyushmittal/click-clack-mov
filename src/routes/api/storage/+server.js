import { z } from 'zod';
import { getActiveWorkIds, trackStorageCleanup } from '$lib/server/active-work.js';
import { apiError, apiSuccess, validationError } from '$lib/server/api-response.js';
import { createLogger } from '$lib/server/logger.js';
import { storageCleanup } from '$lib/server/storage-cleanup.js';

const logger = createLogger('Storage/Cleanup');
const keepIdsSchema = z.array(z.string().uuid()).max(10);
const requestSchema = z.object({ keepIds: keepIdsSchema.default([]) });

function protectedIds(keepIds) {
	return [...new Set([...keepIds, ...getActiveWorkIds()])];
}

export async function GET({ url }) {
	try {
		const validation = keepIdsSchema.safeParse(url.searchParams.getAll('keep'));
		if (!validation.success) return validationError(validation.error);
		return apiSuccess(await storageCleanup.inspect(protectedIds(validation.data)));
	} catch (err) {
		logger.error('Could not inspect processed files', err?.message || err);
		return apiError(err?.message || 'Could not inspect processed files', 500);
	}
}

export async function DELETE({ request }) {
	try {
		const validation = requestSchema.safeParse(await request.json());
		if (!validation.success) return validationError(validation.error);

		return await trackStorageCleanup(async (activeIds) => {
			const keepIds = [...new Set([...validation.data.keepIds, ...activeIds])];
			const result = await storageCleanup.clear(keepIds);
			const remaining = await storageCleanup.inspect(keepIds);
			return apiSuccess({ ...result, bytes: remaining.bytes });
		});
	} catch (err) {
		logger.error('Could not clear processed files', err?.message || err);
		return apiError(err?.message || 'Could not clear processed files', 500);
	}
}
