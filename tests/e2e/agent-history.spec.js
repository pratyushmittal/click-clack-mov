import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { appendAgentHistory } from '../../src/lib/server/agent-history.js';

test('keeps agent events as an append-only JSONL history', async () => {
	const jobDirectory = await mkdtemp(path.join(os.tmpdir(), 'vlogger-history-'));

	try {
		await appendAgentHistory(jobDirectory, {
			type: 'conversation_start',
			instructions: 'Edit the vlog.',
			input: [
				{ role: 'user', content: 'Keep the warm moments.' },
				{ type: 'input_image', image_url: 'data:image/jpeg;base64,very-large-image' }
			]
		});
		await appendAgentHistory(jobDirectory, {
			type: 'tool_call',
			arguments: { intent: 'Inspect the footage.', script: 'ffprobe source.mp4' }
		});

		const events = (await readFile(path.join(jobDirectory, 'agent-history.jsonl'), 'utf8'))
			.trim()
			.split('\n')
			.map(JSON.parse);

		expect(events).toHaveLength(2);
		expect(events.map((event) => event.type)).toEqual(['conversation_start', 'tool_call']);
		expect(events[0].createdAt).toBeTruthy();
		expect(events[0].input[1].image_url).toBe('data:image/jpeg;base64,[omitted 16 characters]');
		expect(events[1].arguments.script).toBe('ffprobe source.mp4');
		expect(await readFile(path.join(jobDirectory, 'agent-history.jsonl'), 'utf8')).not.toContain(
			'very-large-image'
		);
	} finally {
		await rm(jobDirectory, { recursive: true, force: true });
	}
});
