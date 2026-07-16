import { constants } from 'node:fs';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const fontsDirectory = path.resolve('fonts');

export async function prepareFontLibrary(jobDirectory, sourceDirectory = fontsDirectory) {
	const fontDirectory = path.join(jobDirectory, 'fonts');
	await mkdir(fontDirectory, { recursive: true });
	const fileNames = (await readdir(sourceDirectory))
		.filter((fileName) => /\.(otf|ttf)$/i.test(fileName))
		.sort();

	// APFS clones make the font files available inside the agent sandbox without duplication.
	await Promise.all(
		fileNames.map((fileName) =>
			copyFile(
				path.join(sourceDirectory, fileName),
				path.join(fontDirectory, fileName),
				constants.COPYFILE_FICLONE
			)
		)
	);
	return fileNames.map((fileName) => `./fonts/${fileName}`);
}
