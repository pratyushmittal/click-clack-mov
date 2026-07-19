import { execFile } from 'node:child_process';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const exec = promisify(execFile);

export async function runMediaTool(command, args) {
	try {
		return await exec(command, args, { maxBuffer: 20 * 1024 * 1024 });
	} catch (err) {
		throw new Error(`${command} failed: ${err.stderr || err.message}`);
	}
}

export async function getDuration(filePath) {
	const { stdout } = await runMediaTool('ffprobe', [
		'-v',
		'error',
		'-show_entries',
		'format=duration',
		'-of',
		'default=noprint_wrappers=1:nokey=1',
		filePath
	]);
	const duration = Number.parseFloat(stdout.trim());
	if (!Number.isFinite(duration))
		throw new Error(`Could not read duration for ${path.basename(filePath)}`);
	return duration;
}

function timestampLabel(seconds) {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return [hours, minutes, remainingSeconds]
		.map((value) => String(value).padStart(2, '0'))
		.join(':');
}

function timestampSvg(label, width, height) {
	return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
		<rect width="100%" height="100%" fill="#202037"/>
		<text x="10" y="17" fill="#c6ff52" font-family="monospace" font-size="12" font-weight="600">${label}</text>
	</svg>`);
}

export async function createContactSheet(filePath, outputPath, duration) {
	const frameWidth = 240;
	const frameHeight = 136;
	const labelHeight = 24;
	const columns = 6;
	const maxFrames = 240;
	const interval = Math.max(1, Math.min(10, duration / 12), duration / maxFrames);
	const frameDirectory = `${outputPath}-frames`;
	await mkdir(frameDirectory, { recursive: true });

	try {
		const extraction = await runMediaTool('ffmpeg', [
			'-y',
			'-skip_frame',
			'nokey',
			'-i',
			filePath,
			'-vf',
			`select='isnan(prev_selected_t)+gte(t-prev_selected_t,${interval.toFixed(3)})',scale=${frameWidth}:${frameHeight}:force_original_aspect_ratio=decrease,pad=${frameWidth}:${frameHeight}:(ow-iw)/2:(oh-ih)/2:color=0x0b0b16,showinfo`,
			'-fps_mode',
			'vfr',
			'-q:v',
			'4',
			path.join(frameDirectory, 'frame-%05d.jpg')
		]);
		const timestamps = [...extraction.stderr.matchAll(/pts_time:([0-9.]+)/g)].map((match) =>
			Number(match[1])
		);

		const frameNames = (await readdir(frameDirectory))
			.filter((fileName) => fileName.endsWith('.jpg'))
			.sort()
			.slice(0, maxFrames);
		if (!frameNames.length)
			throw new Error(`Could not sample frames from ${path.basename(filePath)}`);

		const sheetColumns = Math.min(columns, frameNames.length);
		const rows = Math.ceil(frameNames.length / sheetColumns);
		const tileHeight = frameHeight + labelHeight;
		const composites = [];
		for (const [index, frameName] of frameNames.entries()) {
			const left = (index % sheetColumns) * frameWidth;
			const top = Math.floor(index / sheetColumns) * tileHeight;
			composites.push({ input: path.join(frameDirectory, frameName), left, top });
			composites.push({
				input: timestampSvg(
					timestampLabel(Math.min(timestamps[index] ?? index * interval, duration)),
					frameWidth,
					labelHeight
				),
				left,
				top: top + frameHeight
			});
		}

		await sharp({
			create: {
				width: sheetColumns * frameWidth,
				height: rows * tileHeight,
				channels: 3,
				background: '#0b0b16'
			}
		})
			.composite(composites)
			.jpeg({ quality: 85, mozjpeg: true })
			.toFile(outputPath);
	} finally {
		await rm(frameDirectory, { recursive: true, force: true });
	}
}

export async function extractAudioChunks(filePath, outputDirectory) {
	const targetBytes = 20 * 1024 * 1024;
	const audioPath = path.join(outputDirectory, 'audio.mp3');
	await mkdir(outputDirectory, { recursive: true });

	try {
		await runMediaTool('ffmpeg', [
			'-y',
			'-i',
			filePath,
			'-vn',
			'-map',
			'0:a:0?',
			'-ac',
			'1',
			'-ar',
			'16000',
			'-b:a',
			'48k',
			audioPath
		]);
	} catch (err) {
		// Silent camera clips legitimately contain no audio stream to transcribe.
		if (!err.message.includes('does not contain any stream')) throw err;
		return [];
	}

	const audioSize = (await stat(audioPath)).size;
	if (audioSize <= targetBytes) return [{ path: audioPath, offset: 0 }];

	const duration = await getDuration(audioPath);
	const chunkSeconds = Math.max(60, Math.floor((duration * targetBytes * 0.9) / audioSize));
	await runMediaTool('ffmpeg', [
		'-y',
		'-i',
		audioPath,
		'-c',
		'copy',
		'-f',
		'segment',
		'-segment_time',
		String(chunkSeconds),
		'-reset_timestamps',
		'1',
		path.join(outputDirectory, 'chunk-%04d.mp3')
	]);
	await rm(audioPath, { force: true });

	const chunks = [];
	let offset = 0;
	const chunkNames = (await readdir(outputDirectory))
		.filter((fileName) => fileName.startsWith('chunk-') && fileName.endsWith('.mp3'))
		.sort();
	for (const chunkName of chunkNames) {
		const chunkPath = path.join(outputDirectory, chunkName);
		chunks.push({ path: chunkPath, offset });
		offset += await getDuration(chunkPath);
	}
	return chunks;
}
