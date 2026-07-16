import { expect, test } from '@playwright/test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createMovieEditorInput } from '../../src/lib/server/movie-editor-context.js';

const image = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
	'base64'
);

test('keeps the user message limited to the submitted vibe', async () => {
	const jobDirectory = await mkdtemp(path.join(tmpdir(), 'vlogger-context-'));
	await mkdir(path.join(jobDirectory, 'music-analysis'));
	await writeFile(path.join(jobDirectory, 'music-analysis/overview.png'), image);
	const contactSheet = path.join(jobDirectory, 'contact-sheet-0.jpg');
	await writeFile(contactSheet, image);

	const input = await createMovieEditorInput({
		videos: [
			{
				index: 0,
				name: 'clip.mp4',
				path: '/job/sources/clip.mp4',
				duration: 12,
				contactSheet,
				segments: [{ start: 1, end: 3, text: 'Hello there' }]
			}
		],
		vibe: 'A warm, reflective travel story',
		targetMinutes: 2,
		jobDirectory,
		music: {
			tracks: [
				{
					title: 'Calm',
					artist: 'Artist',
					musicPath: './music/calm.mp3',
					duration: 60,
					bpm: 100,
					integratedLufs: -14,
					vibes: ['calm'],
					analysisPath: './music-analysis/calm.json',
					timelinePath: './music-analysis/calm.timeline.png'
				}
			]
		}
	});

	expect(input[0].role).toBe('developer');
	const context = input[0].content
		.filter((item) => item.type === 'input_text')
		.map((item) => item.text)
		.join('\n');
	expect(context).toContain('VIDEO 0: clip.mp4');
	expect(context).toContain('Hello there');
	expect(input[1]).toEqual({
		type: 'message',
		role: 'user',
		content: 'A warm, reflective travel story'
	});
});
