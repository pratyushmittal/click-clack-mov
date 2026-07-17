import { expect, test } from '@playwright/test';
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadAgentImage, loadAgentImages } from '../../src/lib/server/agent-image.js';

const tinyPng = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
	'base64'
);

test('loads images from the editing job', async () => {
	const jobDirectory = await mkdtemp(path.join(tmpdir(), 'vlogger-image-'));
	await writeFile(path.join(jobDirectory, 'frame.png'), tinyPng);

	const result = await loadAgentImage('./frame.png', jobDirectory);

	expect(result.path).toBe('./frame.png');
	expect(result.imageUrl).toBe(`data:image/png;base64,${tinyPng.toString('base64')}`);
});

test('does not follow image paths outside the editing job', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'vlogger-image-'));
	const jobDirectory = path.join(root, 'job');
	const outsideImage = path.join(root, 'outside.png');
	await mkdir(jobDirectory);
	await writeFile(outsideImage, tinyPng);
	await symlink(outsideImage, path.join(jobDirectory, 'escaped.png'));

	await expect(loadAgentImage('./escaped.png', jobDirectory)).rejects.toThrow(
		'Image path must stay inside the job directory'
	);
});

test('loads a small batch of images', async () => {
	const jobDirectory = await mkdtemp(path.join(tmpdir(), 'vlogger-images-'));
	await writeFile(path.join(jobDirectory, 'first.png'), tinyPng);
	await writeFile(path.join(jobDirectory, 'second.png'), tinyPng);

	const result = await loadAgentImages(['./first.png', './second.png'], jobDirectory);

	expect(result.images.map((image) => image.path)).toEqual(['./first.png', './second.png']);
	expect(result.errors).toEqual([]);
});

test('limits image batches to six files', async () => {
	await expect(loadAgentImages(Array(7).fill('./frame.png'), '/tmp')).rejects.toThrow(
		'Load between one and six images at a time'
	);
});

test('keeps available images when one generated frame is missing', async () => {
	const jobDirectory = await mkdtemp(path.join(tmpdir(), 'vlogger-images-partial-'));
	await writeFile(path.join(jobDirectory, 'end-01.png'), tinyPng);

	const result = await loadAgentImages(['./end-01.png', './end-02.png'], jobDirectory);

	expect(result.images.map((image) => image.path)).toEqual(['./end-01.png']);
	expect(result.errors).toEqual([
		{
			path: './end-02.png',
			message: expect.stringContaining('no such file or directory')
		}
	]);
});
