import { rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { trackActiveWork } from '$lib/server/active-work.js';
import { apiError, apiSuccess, validationError } from '$lib/server/api-response.js';
import { createLogger } from '$lib/server/logger.js';
import { waitForImportPreprocessing } from '$lib/server/import-preprocessor.js';
import { importedFileSchema, importIdSchema, importsRoot } from '$lib/server/imported-file.js';
import { createMovie } from '$lib/server/movie-pipeline.js';

const logger = createLogger('Movie/Create');
const requestSchema = z.object({
	importId: importIdSchema,
	files: z.array(importedFileSchema).min(1, 'Add at least one video file'),
	vibe: z.string().trim().min(3, 'Describe the vibe you want').max(1000),
	targetMinutes: z
		.number()
		.min(1 / 60)
		.max(60)
		.nullable()
});

export async function POST({ request }) {
	try {
		const data = await request.json();
		const validation = requestSchema.safeParse(data);
		if (!validation.success) return validationError(validation.error);

		const result = await trackActiveWork(validation.data.importId, () =>
			createMovie(
				validation.data.importId,
				validation.data.files,
				validation.data.vibe,
				validation.data.targetMinutes
			)
		);
		// Active speculative work keeps its source until it finishes, without delaying the movie response.
		void waitForImportPreprocessing(validation.data.importId)
			.then(() =>
				rm(path.join(importsRoot, validation.data.importId), { recursive: true, force: true })
			)
			.catch((err) => logger.error('Could not clean imported videos', err?.message || err));
		return apiSuccess({ result });
	} catch (err) {
		logger.error('Failed to create movie', err?.message || err);
		return apiError(err?.message || 'Could not create the movie', 500);
	}
}
