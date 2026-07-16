import { expect, test } from '@playwright/test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareMusicLibrary } from '../../src/lib/server/music-library.js';

const png = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
	'base64'
);

test('prepares the curated music and analysis inside an editing job', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'vlogger-music-'));
	const musicSource = path.join(root, 'sounds');
	const analysisSource = path.join(root, 'analysis');
	const jobDirectory = path.join(root, 'job');
	await Promise.all([mkdir(musicSource), mkdir(analysisSource), mkdir(jobDirectory)]);
	const catalog = {
		tracks: [{ id: 'calm', fileName: 'calm.mp3', title: 'Calm', vibes: ['calm'] }]
	};
	await Promise.all([
		writeFile(path.join(musicSource, 'calm.mp3'), 'audio'),
		writeFile(path.join(analysisSource, 'catalog.json'), JSON.stringify(catalog)),
		writeFile(path.join(analysisSource, 'overview.png'), png),
		writeFile(path.join(analysisSource, 'calm.json'), '{}'),
		writeFile(path.join(analysisSource, 'calm.timeline.png'), png)
	]);

	const result = await prepareMusicLibrary(jobDirectory, musicSource, analysisSource);

	expect(result).toEqual(catalog);
	expect(await readFile(path.join(jobDirectory, 'music/calm.mp3'), 'utf8')).toBe('audio');
	expect(await readFile(path.join(jobDirectory, 'music-analysis/calm.json'), 'utf8')).toBe('{}');
});
