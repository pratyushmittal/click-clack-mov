import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { trackActiveWork } from '$lib/server/active-work.js';
import { apiError, apiSuccess } from '$lib/server/api-response.js';
import { getEditorExportPath, getOrCreateEditorExport } from '$lib/server/editor-export.js';
import { createLogger } from '$lib/server/logger.js';

const logger = createLogger('Movie/EditorExport');

function validJobId(id) {
	return /^[a-f0-9-]{36}$/.test(id);
}

export async function POST({ params }) {
	if (!validJobId(params.id)) return apiError('Movie not found', 404);

	try {
		await trackActiveWork(params.id, () => getOrCreateEditorExport(params.id));
		return apiSuccess({ downloadUrl: `/api/jobs/${params.id}/editor-export` });
	} catch (err) {
		logger.error('Failed to create editor export', err?.message || err);
		return apiError(err?.message || 'Could not create the editor export', 500);
	}
}

export async function GET({ params }) {
	if (!validJobId(params.id)) error(404, 'Editor export not found');

	try {
		const filePath = getEditorExportPath(params.id);
		const info = await stat(filePath);
		return new Response(Readable.toWeb(createReadStream(filePath)), {
			headers: {
				'Content-Type': 'application/zip',
				'Content-Length': String(info.size),
				'Content-Disposition': 'attachment; filename="click-clack-mov-premiere.zip"'
			}
		});
	} catch {
		error(404, 'Editor export not found');
	}
}
