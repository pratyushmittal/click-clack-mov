import { expect, test } from '@playwright/test';
import { createMovieEditorInput } from '../../src/lib/server/movie-editor-context.js';

test('keeps media in a file index and the user message limited to the vibe', () => {
	const input = createMovieEditorInput({
		videos: [
			{
				index: 0,
				name: 'clip.mp4',
				path: '/job/sources/clip.mp4',
				duration: 12,
				segments: [{ start: 1, end: 3, text: 'Hello there' }]
			}
		],
		vibe: 'A warm, reflective travel story',
		targetMinutes: 2,
		music: {
			tracks: [
				{
					title: 'Calm',
					musicPath: './music/calm.mp3',
					analysisPath: './music-analysis/calm.json',
					timelinePath: './music-analysis/calm.timeline.png'
				}
			]
		}
	});

	expect(input[0].role).toBe('developer');
	expect(input[0].content).toHaveLength(1);
	const context = input[0].content[0].text;
	expect(context).toContain('VIDEO 0: clip.mp4');
	expect(context).toContain('Transcript: ./transcript-0.json');
	expect(context).toContain('Contact sheet: ./contact-sheet-0.jpg');
	expect(context).toContain('Catalog: ./music-analysis/catalog.json');
	expect(context).not.toContain('Hello there');
	expect(context).not.toContain('data:image');
	expect(input[1]).toEqual({
		type: 'message',
		role: 'user',
		content: 'A warm, reflective travel story'
	});
});
