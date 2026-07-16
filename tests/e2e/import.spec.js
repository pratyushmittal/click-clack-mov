import { createHash, randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const importsRoot = path.resolve('.vlogger/imports');
const fixture = path.resolve('tests/fixtures/clip-a.mp4');

test('streams a local video into the protected import directory', async ({ request }) => {
	const importId = randomUUID();
	const bytes = await readFile(fixture);

	try {
		const result = await request.post(
			`/api/imports/${importId}?fileName=${encodeURIComponent('../test clip.mp4')}`,
			{
				headers: { 'Content-Type': 'video/mp4' },
				data: bytes
			}
		);
		const data = await result.json();

		expect(result.ok()).toBe(true);
		expect(data.file.originalName).toBe('../test clip.mp4');
		expect(data.file.storedName).toMatch(/^[a-f0-9-]{36}-\.\.-test-clip\.mp4$/);
		expect(data.file.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
		expect(await readFile(path.join(importsRoot, importId, data.file.storedName))).toEqual(bytes);
	} finally {
		await rm(path.join(importsRoot, importId), { recursive: true, force: true });
	}
});
