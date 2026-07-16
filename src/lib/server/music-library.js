import { constants } from 'node:fs';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const soundsDirectory = path.resolve('sounds');
const analysisDirectory = path.resolve('sounds-analysis');

async function cloneFile(source, destination) {
	// APFS clones avoid duplicating the music library for every local editing job.
	await copyFile(source, destination, constants.COPYFILE_FICLONE);
}

export async function prepareMusicLibrary(
	jobDirectory,
	musicSource = soundsDirectory,
	analysisSource = analysisDirectory
) {
	const catalog = JSON.parse(await readFile(path.join(analysisSource, 'catalog.json'), 'utf8'));
	const musicDirectory = path.join(jobDirectory, 'music');
	const jobAnalysisDirectory = path.join(jobDirectory, 'music-analysis');
	await Promise.all([
		mkdir(musicDirectory, { recursive: true }),
		mkdir(jobAnalysisDirectory, { recursive: true })
	]);

	await Promise.all([
		cloneFile(
			path.join(analysisSource, 'catalog.json'),
			path.join(jobAnalysisDirectory, 'catalog.json')
		),
		cloneFile(
			path.join(analysisSource, 'overview.png'),
			path.join(jobAnalysisDirectory, 'overview.png')
		),
		...catalog.tracks.flatMap((track) => [
			cloneFile(path.join(musicSource, track.fileName), path.join(musicDirectory, track.fileName)),
			cloneFile(
				path.join(analysisSource, `${track.id}.json`),
				path.join(jobAnalysisDirectory, `${track.id}.json`)
			),
			cloneFile(
				path.join(analysisSource, `${track.id}.timeline.png`),
				path.join(jobAnalysisDirectory, `${track.id}.timeline.png`)
			)
		])
	]);

	return catalog;
}
