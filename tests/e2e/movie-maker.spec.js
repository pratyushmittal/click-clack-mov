import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
const videos = [path.join(fixtures, 'clip-a.mp4'), path.join(fixtures, 'clip-b.mp4')];
const contactSheet = path.join(fixtures, 'contact-sheet.jpg');

test('shows the Click Clack Mov identity', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle('Click Clack Mov — Little moments, cut together');
	await expect(page.getByText('Click Clack', { exact: true })).toBeVisible();
	await expect(page.getByAltText('Cow filming through a movie frame')).toBeVisible();
});

async function addVideos(page) {
	await page.locator('input[type="file"]').setInputFiles(videos);
	await expect(page.getByText('clip-a.mp4', { exact: true })).toBeVisible();
	await expect(page.getByText('clip-b.mp4', { exact: true })).toBeVisible();
	await expect(page.getByText(/0 MB · 0:08/)).toHaveCount(2);
}

test('accepts more than twelve source videos', async ({ page }) => {
	const bytes = await readFile(videos[0]);
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await page.locator('input[type="file"]').setInputFiles(
		Array.from({ length: 13 }, (_, index) => ({
			name: `clip-${index}.mp4`,
			mimeType: 'video/mp4',
			buffer: bytes
		}))
	);

	await expect(page.getByRole('button', { name: /^Remove clip-/ })).toHaveCount(13);
});

test('reads local video metadata and suggests a 25% target', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Make my movie' }).click();
	await expect(page.getByRole('alert')).toContainText('Drop in at least one video');

	await addVideos(page);
	await expect
		.poll(async () => Number(await page.getByLabel('Target output duration').inputValue()))
		.toBeCloseTo(4 / 60, 2);
});

test('fills vibe and target time from presets', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Teasers' }).click();
	await expect(page.getByLabel('Vibe')).toHaveValue(/Punchy teaser/);
	await expect(page.getByLabel('Target output duration in minutes')).toHaveValue('0.5');

	await page.getByRole('button', { name: 'Story mode' }).click();
	await expect(page.getByLabel('Vibe')).toHaveValue(/Story-first edit/);
	await expect(page.getByLabel('Target output duration in minutes')).toHaveCount(0);

	await page.getByRole('button', { name: 'Reels' }).click();
	await expect(page.getByLabel('Target output duration in minutes')).toHaveValue('0.75');
	await page.getByLabel('Target output duration in minutes').fill('');
	await expect(page.getByLabel('Target output duration in minutes')).toHaveValue('');
});

test('keeps previews moving through analysis, editing, and completion', async ({ page }) => {
	let status = {
		phase: 'analyzing',
		message: 'Analyzing footage',
		processingVideos: {
			0: { index: 0, contactSheetReady: false, transcriptReady: false }
		},
		contactSheets: {},
		events: []
	};
	let finishMovie;
	const movieResult = new Promise((resolve) => (finishMovie = resolve));

	await page.route('**/api/imports/**', async (route) => {
		const fileName = new URL(route.request().url()).searchParams.get('fileName');
		await route.fulfill({
			json: {
				success: true,
				file: { originalName: fileName, storedName: `${crypto.randomUUID()}-${fileName}` }
			}
		});
	});
	await page.route('**/api/jobs/*/status', (route) =>
		route.fulfill({ json: { success: true, status } })
	);
	await page.route('**/api/jobs/*/contact-sheets/*', (route) =>
		route.fulfill({ path: contactSheet, contentType: 'image/jpeg' })
	);
	await page.route('**/api/create-movie', async (route) => {
		const data = route.request().postDataJSON();
		expect(data.files).toHaveLength(2);
		expect(data.targetMinutes).toBeCloseTo(4 / 60, 2);
		await route.fulfill({ json: { success: true, result: await movieResult } });
	});

	await page.goto('/');
	await addVideos(page);
	await page.getByLabel('Vibe').fill('Warm and playful');
	await page.getByRole('button', { name: 'Make my movie' }).click();

	await expect(page.getByRole('heading', { name: 'Generating the transcript' })).toBeVisible();
	const elapsed = page.locator('.copy p');
	await expect(elapsed).toContainText('elapsed');
	const firstElapsed = await elapsed.textContent();
	await page.waitForTimeout(1100);
	await expect.poll(() => elapsed.textContent()).not.toBe(firstElapsed);
	const preview = page.getByLabel('Preview of clip-a.mp4');
	await expect(preview).toBeVisible();
	const firstTime = await preview.evaluate((video) => video.currentTime);
	await page.waitForTimeout(1400);
	await expect
		.poll(() => preview.evaluate((video) => video.currentTime))
		.toBeGreaterThan(firstTime + 1);

	status = {
		phase: 'editing',
		message: 'Rendering the first cut',
		processingVideos: {},
		contactSheets: {
			0: '/api/jobs/test/contact-sheets/0',
			1: '/api/jobs/test/contact-sheets/1'
		},
		events: [
			{ phase: 'editing', message: 'Rendering the first cut', createdAt: '2026-07-15T00:00:00Z' }
		]
	};

	const sheet = page.getByRole('img', { name: /Timestamped contact sheet/ });
	await expect(sheet).toBeVisible({ timeout: 3000 });
	const firstSheet = await sheet.getAttribute('src');
	await expect.poll(() => sheet.getAttribute('src'), { timeout: 5000 }).not.toBe(firstSheet);

	const editingPreview = page.getByLabel(/Preview of clip-/);
	await expect(editingPreview).toBeVisible({ timeout: 5000 });
	const firstPreview = await editingPreview.getAttribute('src');
	await expect
		.poll(() => editingPreview.getAttribute('src'), { timeout: 5000 })
		.not.toBe(firstPreview);
	await expect(page.getByText('Rendering the first cut')).toBeVisible();

	finishMovie({
		id: 'test-job',
		title: 'A tiny test cut',
		summary: 'The mocked edit completed successfully.',
		duration: 4,
		downloadUrl: '/api/jobs/test-job/video',
		clips: [
			{
				fileIndex: 0,
				fileName: 'clip-a.mp4',
				start: 0,
				end: 4,
				speed: 1,
				reason: 'A useful opening beat.'
			}
		]
	});

	await expect(page.getByRole('heading', { name: 'A tiny test cut' })).toBeVisible();
	await expect(page.getByText(/video · .* processing/)).toBeVisible();
	await expect(page.getByRole('link', { name: 'Download movie' })).toHaveAttribute(
		'href',
		'/api/jobs/test-job/video'
	);
});
