import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
	createContactSheet,
	extractAudioChunks,
	getDuration,
	hasAudio
} from '$lib/server/media.js';
import { runEditingAgent, transcribeChunks } from '$lib/server/openai.js';
import { createLogger } from '$lib/server/logger.js';
import { updateJobStatus } from '$lib/server/job-status.js';

const logger = createLogger('MoviePipeline');
const jobsRoot = path.resolve('.vlogger/jobs');
const importsRoot = path.resolve('.vlogger/imports');

function safeFileName(fileName) {
	return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function normalizeClips(clips, videos) {
	return clips
		.filter((clip) => Number.isInteger(clip.fileIndex) && videos[clip.fileIndex])
		.map((clip) => ({
			...clip,
			start: Math.max(0, Math.min(Number(clip.start), videos[clip.fileIndex].duration)),
			end: Math.max(0, Math.min(Number(clip.end), videos[clip.fileIndex].duration))
		}))
		.filter((clip) => clip.end - clip.start >= 1);
}

async function processVideo(file, index, files, importId, jobDirectory, sourceDirectory) {
	const filePath = path.join(
		sourceDirectory,
		`${String(index).padStart(2, '0')}-${safeFileName(file.originalName)}`
	);
	await rename(path.join(importsRoot, importId, file.storedName), filePath);
	const duration = await getDuration(filePath);
	const sourceHasAudio = await hasAudio(filePath);
	const contactSheet = path.join(jobDirectory, `contact-sheet-${index}.jpg`);
	const audioDirectory = path.join(jobDirectory, `audio-${index}`);
	logger.info(`Analyzing ${file.originalName}`);

	const contactSheetTask = (async () => {
		await updateJobStatus(jobDirectory, {
			phase: 'contact-sheets',
			message: `Creating contact sheet ${index + 1} of ${files.length}: ${file.originalName}`
		});
		await createContactSheet(filePath, contactSheet, duration);
	})();
	const transcriptionTask = (async () => {
		await updateJobStatus(jobDirectory, {
			phase: 'transcribing',
			message: `Transcribing video ${index + 1} of ${files.length}: ${file.originalName}`
		});
		const chunks = await extractAudioChunks(filePath, audioDirectory);
		return transcribeChunks(chunks);
	})();
	const [, segments] = await Promise.all([contactSheetTask, transcriptionTask]);

	await writeFile(
		path.join(jobDirectory, `transcript-${index}.json`),
		JSON.stringify(segments, null, 2)
	);
	return {
		index,
		name: file.originalName,
		path: filePath,
		duration,
		hasAudio: sourceHasAudio,
		contactSheet,
		segments
	};
}

async function processVideos(files, concurrency, work) {
	const results = [];
	for (let index = 0; index < files.length; index += concurrency) {
		results.push(
			...(await Promise.all(
				files.slice(index, index + concurrency).map((file, offset) => work(file, index + offset))
			))
		);
	}
	return results;
}

export async function createMovie(importId, files, vibe, targetMinutes) {
	const id = importId;
	const jobDirectory = path.join(jobsRoot, id);
	const sourceDirectory = path.join(jobDirectory, 'sources');
	await mkdir(sourceDirectory, { recursive: true });
	logger.debug('Job directory', jobDirectory);
	await updateJobStatus(jobDirectory, {
		phase: 'preparing',
		message: 'Preparing the local editing job'
	});
	const concurrency = Math.max(1, Math.min(Number(process.env.VIDEO_CONCURRENCY) || 2, 4));
	const videos = await processVideos(files, concurrency, (file, index) =>
		processVideo(file, index, files, importId, jobDirectory, sourceDirectory)
	);

	const edit = await runEditingAgent(videos, vibe, targetMinutes, jobDirectory);
	const clips = normalizeClips(edit.clips, videos);
	if (!clips.length) throw new Error('The editor could not find any usable clips');

	const result = {
		id,
		title: edit.title,
		summary: edit.summary,
		duration: clips.reduce((total, clip) => total + clip.end - clip.start, 0),
		clips: clips.map((clip) => ({ ...clip, fileName: videos[clip.fileIndex].name })),
		downloadUrl: `/api/jobs/${id}/video`
	};
	await writeFile(path.join(jobDirectory, 'result.json'), JSON.stringify(result, null, 2));
	await updateJobStatus(jobDirectory, { phase: 'complete', message: 'Your first cut is ready' });
	return result;
}

export function getMoviePath(id) {
	return path.join(jobsRoot, id, 'vlogger-cut.mp4');
}
