import path from 'node:path';
import { readFile, realpath, stat } from 'node:fs/promises';

const imageTypes = new Map([
	['.jpg', 'image/jpeg'],
	['.jpeg', 'image/jpeg'],
	['.png', 'image/png'],
	['.webp', 'image/webp']
]);
const maxImageBytes = 20 * 1024 * 1024;

export async function loadAgentImage(imagePath, jobDirectory) {
	// Relative paths keep image access confined to the current editing job.
	if (path.isAbsolute(imagePath))
		throw new Error('Image path must be relative to the job directory');

	const jobPath = await realpath(jobDirectory);
	const filePath = await realpath(path.resolve(jobPath, imagePath));
	const relativePath = path.relative(jobPath, filePath);

	// realpath prevents symlinks from escaping the job directory.
	if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
		throw new Error('Image path must stay inside the job directory');
	}

	const mediaType = imageTypes.get(path.extname(filePath).toLowerCase());
	if (!mediaType) throw new Error('Image must be a JPEG, PNG, or WebP file');

	const file = await stat(filePath);
	if (!file.isFile()) throw new Error('Image path must point to a file');
	if (file.size > maxImageBytes) throw new Error('Image must be smaller than 20 MB');

	return {
		path: `./${relativePath}`,
		imageUrl: `data:${mediaType};base64,${(await readFile(filePath)).toString('base64')}`
	};
}
