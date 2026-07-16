import { rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { apiError, apiSuccess, validationError } from '$lib/server/api-response.js';
import { createLogger } from '$lib/server/logger.js';
import { createMovie } from '$lib/server/movie-pipeline.js';

const logger = createLogger('Movie/Create');
const importsRoot = path.resolve('.vlogger/imports');
const fileSchema = z.object({
	storedName: z.string().regex(/^[a-zA-Z0-9._-]+$/),
	originalName: z.string().trim().min(1).max(255),
	size: z.number().nonnegative(),
	sha256: z.string().regex(/^[a-f0-9]{64}$/)
});
const requestSchema = z.object({
	importId: z.string().uuid(),
	files: z.array(fileSchema).min(1, 'Add at least one video file'),
	vibe: z.string().trim().min(3, 'Describe the vibe you want').max(1000),
	targetMinutes: z
		.number()
		.min(1 / 60)
		.max(60)
		.nullable()
});

export async function POST({ request }) {
	let importDirectory;

	try {
		const data = await request.json();
		const validation = requestSchema.safeParse(data);
		if (!validation.success) return validationError(validation.error);

		importDirectory = path.join(importsRoot, validation.data.importId);
		const result = await createMovie(
			validation.data.importId,
			validation.data.files,
			validation.data.vibe,
			validation.data.targetMinutes
		);
		return apiSuccess({ result });
	} catch (err) {
		logger.error('Failed to create movie', err?.message || err);
		return apiError(err?.message || 'Could not create the movie', 500);
	} finally {
		if (importDirectory) await rm(importDirectory, { recursive: true, force: true });
	}
}
