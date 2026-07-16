import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const exec = promisify(execFile);
const soundsDirectory = path.resolve('sounds');
const analysisDirectory = path.resolve('sounds-analysis');
const timelineWidth = 1600;
const timelineHeight = 300;

function escapeXml(value) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function timestamp(seconds) {
	const minutes = Math.floor(seconds / 60);
	return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

async function command(commandName, args) {
	try {
		return await exec(commandName, args, { maxBuffer: 20 * 1024 * 1024 });
	} catch (err) {
		throw new Error(`${commandName} failed: ${err.stderr || err.message}`);
	}
}

async function durationOf(filePath) {
	const { stdout } = await command('ffprobe', [
		'-v',
		'error',
		'-show_entries',
		'format=duration',
		'-of',
		'csv=p=0',
		filePath
	]);
	return Number(stdout.trim());
}

async function analyzeRhythm(filePath, duration) {
	const [{ stdout: tempoOutput }, { stdout: beatOutput }, { stdout: onsetOutput }] =
		await Promise.all([
			command('aubio', ['tempo', filePath]),
			command('aubiotrack', ['-i', filePath, '-T', 'seconds']),
			command('aubioonset', ['-i', filePath, '-T', 'seconds'])
		]);
	const values = (output) =>
		output
			.trim()
			.split(/\s+/)
			.map(Number)
			.filter((value) => Number.isFinite(value) && value >= 0 && value <= duration)
			.map((value) => Number(value.toFixed(3)));

	return {
		bpm: Number(Number.parseFloat(tempoOutput).toFixed(2)),
		beats: values(beatOutput),
		onsets: values(onsetOutput)
	};
}

async function analyzeLoudness(filePath) {
	const { stderr } = await command('ffmpeg', [
		'-hide_banner',
		'-nostats',
		'-i',
		filePath,
		'-filter_complex',
		'ebur128=peak=true',
		'-f',
		'null',
		'-'
	]);
	const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
	const number = (pattern) => Number(summary.match(pattern)?.[1]);

	return {
		integratedLufs: number(/Integrated loudness:[\s\S]*?I:\s*(-?[\d.]+) LUFS/),
		loudnessRangeLu: number(/Loudness range:[\s\S]*?LRA:\s*(-?[\d.]+) LU/),
		truePeakDbfs: number(/True peak:[\s\S]*?Peak:\s*(-?[\d.]+) dBFS/)
	};
}

function timelineOverlay(track) {
	const plotTop = 62;
	const plotHeight = 188;
	const beatLines = track.beats
		.map((beat, index) => {
			const x = (beat / track.duration) * timelineWidth;
			const strong = index % 4 === 0;
			return `<line x1="${x.toFixed(2)}" y1="${plotTop}" x2="${x.toFixed(2)}" y2="${plotTop + plotHeight}" stroke="${strong ? '#ff9d66' : '#6de7ff'}" stroke-width="${strong ? 1.4 : 0.7}" opacity="${strong ? 0.72 : 0.32}"/>`;
		})
		.join('');
	const gridLines = [];
	for (let seconds = 0; seconds <= track.duration; seconds += 10) {
		const x = (seconds / track.duration) * timelineWidth;
		gridLines.push(
			`<line x1="${x.toFixed(2)}" y1="${plotTop}" x2="${x.toFixed(2)}" y2="${plotTop + plotHeight + 18}" stroke="#ffffff" stroke-width="1" opacity="0.2"/>`
		);
		gridLines.push(
			`<text x="${Math.min(x + 5, timelineWidth - 42).toFixed(2)}" y="278" fill="#a9a9bf" font-family="monospace" font-size="14">${timestamp(seconds)}</text>`
		);
	}

	return Buffer.from(`<svg width="${timelineWidth}" height="${timelineHeight}" xmlns="http://www.w3.org/2000/svg">
		<rect width="100%" height="100%" fill="none"/>
		<text x="24" y="29" fill="#f6f3ff" font-family="sans-serif" font-size="21" font-weight="700">${escapeXml(track.title)}</text>
		<text x="24" y="51" fill="#a9a9bf" font-family="sans-serif" font-size="14">${escapeXml(track.artist)} · ${track.duration.toFixed(1)}s · ${track.bpm.toFixed(1)} BPM · ${track.integratedLufs.toFixed(1)} LUFS · ${escapeXml(track.vibes.join(', '))}</text>
		${gridLines.join('')}
		${beatLines}
		<text x="${timelineWidth - 270}" y="290" fill="#6de7ff" font-family="sans-serif" font-size="12">thin: detected beat</text>
		<text x="${timelineWidth - 135}" y="290" fill="#ff9d66" font-family="sans-serif" font-size="12">bright: 4-beat guide</text>
	</svg>`);
}

async function createTimeline(track, filePath, outputPath) {
	const waveformPath = `${outputPath}.waveform.png`;
	await command('ffmpeg', [
		'-y',
		'-hide_banner',
		'-loglevel',
		'error',
		'-i',
		filePath,
		'-filter_complex',
		`aformat=channel_layouts=mono,showwavespic=s=${timelineWidth}x188:colors=0xc6ff52`,
		'-frames:v',
		'1',
		waveformPath
	]);

	await sharp({
		create: {
			width: timelineWidth,
			height: timelineHeight,
			channels: 3,
			background: '#111122'
		}
	})
		.composite([
			{ input: await sharp(waveformPath).png().toBuffer(), top: 62, left: 0 },
			{ input: timelineOverlay(track), top: 0, left: 0 }
		])
		.png()
		.toFile(outputPath);
	await rm(waveformPath);
}

async function createOverview(tracks) {
	const rowWidth = 1400;
	const rowHeight = 263;
	const rows = await Promise.all(
		tracks.map((track) =>
			sharp(path.join(analysisDirectory, `${track.id}.timeline.png`))
				.resize(rowWidth, rowHeight)
				.png()
				.toBuffer()
		)
	);

	await sharp({
		create: {
			width: rowWidth,
			height: rowHeight * rows.length,
			channels: 3,
			background: '#111122'
		}
	})
		.composite(rows.map((input, index) => ({ input, left: 0, top: index * rowHeight })))
		.png()
		.toFile(path.join(analysisDirectory, 'overview.png'));
}

async function analyzeTrack(track) {
	const filePath = path.join(soundsDirectory, track.fileName);
	const duration = await durationOf(filePath);
	const [rhythm, loudness] = await Promise.all([
		analyzeRhythm(filePath, duration),
		analyzeLoudness(filePath)
	]);
	const result = {
		...track,
		duration: Number(duration.toFixed(3)),
		...rhythm,
		...loudness,
		firstBeat: rhythm.beats[0] ?? null,
		musicPath: `./music/${track.fileName}`,
		analysisPath: `./music-analysis/${track.id}.json`,
		timelinePath: `./music-analysis/${track.id}.timeline.png`
	};
	await writeFile(
		path.join(analysisDirectory, `${track.id}.json`),
		JSON.stringify(result, null, 2)
	);
	await createTimeline(result, filePath, path.join(analysisDirectory, `${track.id}.timeline.png`));
	return result;
}

await mkdir(analysisDirectory, { recursive: true });
const library = JSON.parse(await readFile(path.join(soundsDirectory, 'library.json'), 'utf8'));
const tracks = [];
for (const track of library.tracks) {
	console.log(`Analyzing ${track.title}...`);
	tracks.push(await analyzeTrack(track));
}
await createOverview(tracks);
await writeFile(
	path.join(analysisDirectory, 'catalog.json'),
	JSON.stringify(
		{
			license: library.license,
			tracks: tracks.map(({ beats, onsets, source: _source, ...track }) => ({
				...track,
				beatCount: beats.length,
				onsetCount: onsets.length
			}))
		},
		null,
		2
	)
);
console.log(`Analyzed ${tracks.length} tracks into ${analysisDirectory}`);
