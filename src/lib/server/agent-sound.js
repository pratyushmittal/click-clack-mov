import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { runMediaTool } from './media.js';

const apiUrl = 'https://api.openverse.org/v1/audio/';
const allowedHosts = new Set(['cdn.freesound.org', 'upload.wikimedia.org']);
const allowedTypes = new Map([
	['mp3', 'audio/mpeg'],
	['ogg', 'audio/ogg'],
	['wav', 'audio/wav'],
	['flac', 'audio/flac'],
	['m4a', 'audio/mp4']
]);
const maxDownloads = 3;
const maxFileBytes = 20 * 1024 * 1024;
const requestHeaders = {
	Accept: 'application/json',
	'User-Agent': 'ClickClackMov/0.1 (local macOS video editor)'
};

function safeName(value) {
	return (
		value
			.normalize('NFKD')
			.replace(/[^a-zA-Z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.toLowerCase()
			.slice(0, 60) || 'sound-effect'
	);
}

function checkAudioUrl(value) {
	const url = new URL(value);
	if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) {
		throw new Error('Openverse returned audio from an unsupported host');
	}
	return url;
}

async function readJson(filePath, fallback) {
	try {
		return JSON.parse(await readFile(filePath, 'utf8'));
	} catch (err) {
		// A new job or cache has no manifest until its first downloaded sound.
		if (err.code === 'ENOENT') return fallback;
		throw err;
	}
}

async function fetchAudio(url, fetcher) {
	let currentUrl = checkAudioUrl(url);

	for (let redirect = 0; redirect < 4; redirect += 1) {
		const result = await fetcher(currentUrl, {
			redirect: 'manual',
			signal: AbortSignal.timeout(20_000),
			headers: { 'User-Agent': requestHeaders['User-Agent'] }
		});

		if (result.status >= 300 && result.status < 400) {
			const location = result.headers.get('location');
			if (!location) throw new Error('The sound download returned an invalid redirect');
			currentUrl = checkAudioUrl(new URL(location, currentUrl).toString());
			continue;
		}
		if (!result.ok) throw new Error(`The sound download failed with HTTP ${result.status}`);
		checkAudioUrl(result.url || currentUrl.toString());

		const contentLength = Number(result.headers.get('content-length'));
		if (Number.isFinite(contentLength) && contentLength > maxFileBytes) {
			throw new Error('The downloaded sound is larger than 20 MB');
		}

		const reader = result.body?.getReader();
		if (!reader) throw new Error('The sound download returned no audio');
		const chunks = [];
		let size = 0;
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.length;
			if (size > maxFileBytes) {
				await reader.cancel();
				throw new Error('The downloaded sound is larger than 20 MB');
			}
			chunks.push(value);
		}
		return {
			buffer: Buffer.concat(chunks),
			contentType: result.headers.get('content-type')?.split(';')[0]
		};
	}

	throw new Error('The sound download redirected too many times');
}

async function inspectAudio(filePath, maxDurationSeconds) {
	const { stdout } = await runMediaTool('ffprobe', [
		'-v',
		'error',
		'-select_streams',
		'a:0',
		'-show_entries',
		'stream=codec_type:format=duration',
		'-of',
		'json',
		filePath
	]);
	const data = JSON.parse(stdout);
	const duration = Number(data.format?.duration);
	if (data.streams?.[0]?.codec_type !== 'audio' || !Number.isFinite(duration)) {
		throw new Error('The downloaded file is not valid audio');
	}
	if (duration > maxDurationSeconds + 0.25) {
		throw new Error(`The downloaded sound exceeds the requested ${maxDurationSeconds} seconds`);
	}
	return duration;
}

async function cloneFile(source, destination) {
	// APFS cloning keeps cached sounds cheap across local editing jobs.
	await copyFile(source, destination, constants.COPYFILE_FICLONE);
}

async function addCredits(jobDirectory, metadata) {
	const creditsPath = path.join(jobDirectory, 'audio-credits.json');
	const credits = await readJson(creditsPath, []);
	const existing = credits.find((item) => item.sourceId === metadata.sourceId);
	if (existing) return existing;

	credits.push(metadata);
	await writeFile(creditsPath, `${JSON.stringify(credits, null, 2)}\n`);
	await writeFile(
		path.join(jobDirectory, 'audio-credits.txt'),
		`${credits.map((item) => item.attribution).join('\n')}\n`
	);
	return metadata;
}

async function useCachedSound(candidate, jobDirectory, cacheDirectory, manifest) {
	const lookupPath = path.join(cacheDirectory, 'openverse', `${candidate.id}.json`);
	const lookup = await readJson(lookupPath, null);
	if (!lookup) return null;

	const cachePath = path.join(cacheDirectory, lookup.hash, lookup.fileName);
	try {
		await stat(cachePath);
	} catch (err) {
		// An interrupted cache write can leave a stale lookup behind.
		if (err.code === 'ENOENT') return null;
		throw err;
	}

	const fileName = `${safeName(candidate.title)}-${candidate.id.slice(0, 8)}.${lookup.fileType}`;
	const destination = path.join(jobDirectory, 'downloaded-audio', fileName);
	await cloneFile(cachePath, destination);
	const metadata = await addCredits(jobDirectory, {
		...lookup.metadata,
		path: `./downloaded-audio/${fileName}`
	});
	manifest.push(metadata);
	return metadata;
}

function soundCandidate(result, maxDurationSeconds) {
	const duration = Number(result.duration) / 1000;
	const fileType = String(result.filetype || '').toLowerCase();
	if (
		result.license !== 'cc0' ||
		result.mature ||
		!Number.isFinite(duration) ||
		duration <= 0 ||
		duration > maxDurationSeconds ||
		!allowedTypes.has(fileType) ||
		(Number(result.filesize) || 0) > maxFileBytes
	) {
		return null;
	}

	try {
		checkAudioUrl(result.url);
	} catch {
		return null;
	}
	return { ...result, duration, fileType };
}

export async function downloadAgentSound(
	{ query, maxDurationSeconds },
	jobDirectory,
	{
		fetcher = fetch,
		cacheDirectory = path.resolve('.vlogger/cache/audio'),
		apiToken = process.env.OPENVERSE_API_TOKEN
	} = {}
) {
	const search = query.trim();
	if (!search || search.length > 120)
		throw new Error('Sound query must contain 1 to 120 characters');
	if (
		!Number.isFinite(maxDurationSeconds) ||
		maxDurationSeconds < 0.25 ||
		maxDurationSeconds > 30
	) {
		throw new Error('Sound duration must be between 0.25 and 30 seconds');
	}

	const downloadDirectory = path.join(jobDirectory, 'downloaded-audio');
	const manifestPath = path.join(downloadDirectory, 'manifest.json');
	await mkdir(downloadDirectory, { recursive: true });
	const manifest = await readJson(manifestPath, []);
	if (manifest.length >= maxDownloads)
		throw new Error('This edit already has three downloaded sounds');

	const url = new URL(apiUrl);
	url.searchParams.set('q', search);
	url.searchParams.set('license', 'cc0');
	url.searchParams.set('page_size', '20');
	const headers = {
		...requestHeaders,
		...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {})
	};
	const result = await fetcher(url, { headers, signal: AbortSignal.timeout(20_000) });
	if (!result.ok) throw new Error(`Openverse search failed with HTTP ${result.status}`);
	const data = await result.json();
	const candidates = (data.results || [])
		.map((item) => soundCandidate(item, maxDurationSeconds))
		.filter(Boolean);
	if (!candidates.length) throw new Error('No suitable CC0 sound effect was found');

	for (const candidate of candidates) {
		const existing = manifest.find((item) => item.sourceId === candidate.id);
		if (existing) return existing;
	}
	if (manifest.length >= maxDownloads)
		throw new Error('This edit already has three downloaded sounds');

	for (const candidate of candidates) {
		const cached = await useCachedSound(candidate, jobDirectory, cacheDirectory, manifest);
		if (cached) {
			await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
			return cached;
		}
	}

	const candidate = candidates[0];
	const { buffer, contentType } = await fetchAudio(candidate.url, fetcher);
	if (
		contentType &&
		!contentType.startsWith('audio/') &&
		contentType !== 'application/ogg' &&
		contentType !== 'application/octet-stream'
	) {
		throw new Error(`The sound download returned the unsupported type ${contentType}`);
	}

	const hash = createHash('sha256').update(buffer).digest('hex');
	const cachePath = path.join(cacheDirectory, hash, `audio.${candidate.fileType}`);
	const temporaryPath = `${cachePath}.${process.pid}.tmp`;
	await mkdir(path.dirname(cachePath), { recursive: true });
	await writeFile(temporaryPath, buffer);
	try {
		const duration = await inspectAudio(temporaryPath, maxDurationSeconds);
		await writeFile(cachePath, buffer);
		const metadata = {
			provider: 'openverse',
			source: candidate.source,
			sourceId: candidate.id,
			title: candidate.title,
			creator: candidate.creator || 'Unknown creator',
			duration,
			license: 'CC0-1.0',
			licenseUrl: candidate.license_url,
			sourceUrl: candidate.foreign_landing_url,
			attribution:
				candidate.attribution ||
				`"${candidate.title}" by ${candidate.creator || 'Unknown creator'} is marked CC0 1.0.`
		};
		const lookupDirectory = path.join(cacheDirectory, 'openverse');
		await mkdir(lookupDirectory, { recursive: true });
		await writeFile(
			path.join(lookupDirectory, `${candidate.id}.json`),
			`${JSON.stringify(
				{
					hash,
					fileName: `audio.${candidate.fileType}`,
					fileType: candidate.fileType,
					metadata
				},
				null,
				2
			)}\n`
		);

		const fileName = `${safeName(candidate.title)}-${candidate.id.slice(0, 8)}.${candidate.fileType}`;
		await cloneFile(cachePath, path.join(downloadDirectory, fileName));
		const jobMetadata = await addCredits(jobDirectory, {
			...metadata,
			path: `./downloaded-audio/${fileName}`
		});
		manifest.push(jobMetadata);
		await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
		return jobMetadata;
	} finally {
		await rm(temporaryPath, { force: true });
	}
}
