import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { apiError, apiSuccess } from '$lib/server/api-response.js';
import { createLogger } from '$lib/server/logger.js';

const logger = createLogger('Import/Create');
const importsRoot = path.resolve('.vlogger/imports');

function safeFileName(fileName) {
	return fileName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-180) || 'video';
}

export async function POST({ params, request, url }) {
	let filePath;

	try {
		if (!/^[a-f0-9-]{36}$/.test(params.id)) return apiError('Invalid import ID', 400);
		if (!request.body) return apiError('The selected video was empty', 400);

		const fileName = url.searchParams.get('fileName') || 'video';
		const fileSize = Number(request.headers.get('content-length'));
		const storedName = `${randomUUID()}-${safeFileName(fileName)}`;
		const importDirectory = path.join(importsRoot, params.id);
		filePath = path.join(importDirectory, storedName);
		await mkdir(importDirectory, { recursive: true });

		const hash = createHash('sha256');
		const hashStream = new Transform({
			transform(chunk, encoding, callback) {
				// Hash while importing so cache lookup never needs a second full file read.
				hash.update(chunk);
				callback(null, chunk);
			}
		});

		// Browser files have no readable local path, so stream their bytes to the local job area.
		await pipeline(Readable.fromWeb(request.body), hashStream, createWriteStream(filePath));
		return apiSuccess({
			file: {
				storedName,
				originalName: fileName,
				size: fileSize || 0,
				sha256: hash.digest('hex')
			}
		});
	} catch (err) {
		if (filePath) await rm(filePath, { force: true });
		logger.error('Failed to import video', err?.message || err);
		return apiError(err?.message || 'Could not import the video', 500);
	}
}
