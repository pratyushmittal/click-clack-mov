import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { error } from '@sveltejs/kit';

const jobsRoot = path.resolve('.vlogger/jobs');

export async function GET({ params }) {
	if (!/^[a-f0-9-]{36}$/.test(params.id) || !/^\d+$/.test(params.index)) {
		error(404, 'Contact sheet not found');
	}
	const filePath = path.join(jobsRoot, params.id, `contact-sheet-${params.index}.jpg`);

	try {
		const info = await stat(filePath);
		return new Response(Readable.toWeb(createReadStream(filePath)), {
			headers: {
				'Content-Type': 'image/jpeg',
				'Content-Length': String(info.size),
				'Cache-Control': 'private, max-age=31536000, immutable'
			}
		});
	} catch {
		error(404, 'Contact sheet not found');
	}
}
