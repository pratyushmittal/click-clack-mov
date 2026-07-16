import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createContactSheet, extractAudioChunks, getDuration } from '$lib/server/media.js';
import { runEditingAgent, transcribeVideo } from '$lib/server/openai.js';
import { createLogger } from '$lib/server/logger.js';
import { updateJobStatus } from '$lib/server/job-status.js';
import { prepareMusicLibrary } from '$lib/server/music-library.js';
import { getOrCreateContactSheet } from '$lib/server/contact-sheet-cache.js';

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
			end: Math.max(0, Math.min(Number(clip.end), videos[clip.fileIndex].duration)),
			speed: Math.max(0.25, Math.min(Number(clip.speed) || 1, 8))
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
	const contactSheet = path.join(jobDirectory, `contact-sheet-${index}.jpg`);
	const audioDirectory = path.join(jobDirectory, `audio-${index}`);
	const transcriptionDisabled = process.env.DISABLE_TRANSCRIPTION === 'true';
	logger.info(`Analyzing ${file.originalName}`);
	await updateJobStatus(jobDirectory, {
		phase: 'analyzing',
		message: `Analyzing video ${index + 1} of ${files.length}: ${file.originalName}`,
		processingVideo: {
			index,
			contactSheetReady: false,
			transcriptReady: transcriptionDisabled
		}
	});

	const contactSheetTask = (async () => {
		const result = await getOrCreateContactSheet(file.sha256, contactSheet, (outputPath) =>
			createContactSheet(filePath, outputPath, duration)
		);
		logger.info(
			`${result.cached ? 'Reused cached' : 'Generated'} camera roll for ${file.originalName}`
		);
		await updateJobStatus(jobDirectory, {
			contactSheet: {
				index,
				url: `/api/jobs/${path.basename(jobDirectory)}/contact-sheets/${index}`
			},
			processingVideo: { index, contactSheetReady: true }
		});
	})();
	const transcriptionTask = transcriptionDisabled
		? Promise.resolve({ segments: [], cached: false })
		: (async () => {
				const result = await transcribeVideo(file.sha256, () =>
					extractAudioChunks(filePath, audioDirectory)
				);
				logger.info(
					`${result.cached ? 'Reused cached' : 'Generated'} transcript for ${file.originalName}`
				);
				await updateJobStatus(jobDirectory, {
					processingVideo: { index, transcriptReady: true }
				});
				return result;
			})();
	const [, transcription] = await Promise.all([contactSheetTask, transcriptionTask]);
	const segments = transcription.segments;

	await writeFile(
		path.join(jobDirectory, `transcript-${index}.json`),
		JSON.stringify(segments, null, 2)
	);
	await updateJobStatus(jobDirectory, { processingVideo: { index, done: true } });
	return {
		index,
		name: file.originalName,
		path: filePath,
		duration,
		contactSheet,
		segments
	};
}

async function processVideos(files, concurrency, work) {
	const results = Array(files.length);
	let nextIndex = 0;

	async function processNext() {
		while (nextIndex < files.length) {
			// Each worker claims its next source before another asynchronous step can start.
			const index = nextIndex;
			nextIndex += 1;
			results[index] = await work(files[index], index);
		}
	}

	await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, processNext));
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
	const [videos, music] = await Promise.all([
		processVideos(files, concurrency, (file, index) =>
			processVideo(file, index, files, importId, jobDirectory, sourceDirectory)
		),
		prepareMusicLibrary(jobDirectory)
	]);

	const edit = await runEditingAgent(videos, vibe, targetMinutes, jobDirectory, music);
	const clips = normalizeClips(edit.clips, videos);
	if (!clips.length) throw new Error('The editor could not find any usable clips');

	const result = {
		id,
		title: edit.title,
		summary: edit.summary,
		duration: await getDuration(path.join(jobDirectory, 'vlogger-cut.mp4')),
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
