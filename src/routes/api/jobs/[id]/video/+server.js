import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { getMoviePath } from '$lib/server/movie-pipeline.js';

export async function GET({ params }) {
	if (!/^[a-f0-9-]{36}$/.test(params.id)) error(404, 'Movie not found');
	const filePath = getMoviePath(params.id);

	try {
		const info = await stat(filePath);
		return new Response(Readable.toWeb(createReadStream(filePath)), {
			headers: {
				'Content-Type': 'video/mp4',
				'Content-Length': String(info.size),
				'Content-Disposition': 'attachment; filename="click-clack-mov.mp4"'
			}
		});
	} catch {
		error(404, 'Movie not found');
	}
}
