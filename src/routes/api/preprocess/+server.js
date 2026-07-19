import { z } from 'zod';
import { apiError, apiSuccess, validationError } from '$lib/server/api-response.js';
import { importedFileSchema, importIdSchema } from '$lib/server/imported-file.js';
import { startImportedPreprocessing } from '$lib/server/import-preprocessor.js';
import { createLogger } from '$lib/server/logger.js';

const logger = createLogger('Import/Preprocess');
const requestSchema = z.object({
	importId: importIdSchema,
	file: importedFileSchema
});

export async function POST({ request }) {
	try {
		const validation = requestSchema.safeParse(await request.json());
		if (!validation.success) return validationError(validation.error);
		void startImportedPreprocessing(validation.data.importId, validation.data.file);
		return apiSuccess({ started: true });
	} catch (err) {
		logger.error('Could not start preprocessing', err?.message || err);
		return apiError(err?.message || 'Could not start video preprocessing', 500);
	}
}
