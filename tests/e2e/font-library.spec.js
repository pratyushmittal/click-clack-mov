import { expect, test } from '@playwright/test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareFontLibrary } from '../../src/lib/server/font-library.js';

test('prepares custom fonts inside an editing job', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'vlogger-fonts-'));
	const sourceDirectory = path.join(root, 'source');
	const jobDirectory = path.join(root, 'job');
	await Promise.all([mkdir(sourceDirectory), mkdir(jobDirectory)]);
	await Promise.all([
		writeFile(path.join(sourceDirectory, 'title.ttf'), 'title font'),
		writeFile(path.join(sourceDirectory, 'accent.otf'), 'accent font'),
		writeFile(path.join(sourceDirectory, 'notes.txt'), 'not a font')
	]);

	const fonts = await prepareFontLibrary(jobDirectory, sourceDirectory);

	expect(fonts).toEqual(['./fonts/accent.otf', './fonts/title.ttf']);
	expect(await readFile(path.join(jobDirectory, 'fonts/title.ttf'), 'utf8')).toBe('title font');
	expect(await readFile(path.join(jobDirectory, 'fonts/accent.otf'), 'utf8')).toBe('accent font');
});
