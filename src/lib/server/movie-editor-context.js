import { loadAgentImage } from '$lib/server/agent-image.js';
import { imageDataUrl } from '$lib/server/media.js';

function musicSummary(music) {
	return music.tracks
		.map(
			(track, index) =>
				`${index + 1}. ${track.title} by ${track.artist}\n   Music: ${track.musicPath}\n   Duration: ${track.duration.toFixed(1)}s · BPM: ${track.bpm.toFixed(1)} · Loudness: ${track.integratedLufs.toFixed(1)} LUFS\n   Vibes: ${track.vibes.join(', ')}\n   Beats and onsets: ${track.analysisPath}\n   Detailed timeline: ${track.timelinePath}`
		)
		.join('\n');
}

function videoSummary(video) {
	const transcript =
		video.segments
			.map(
				(segment) =>
					`[${segment.start.toFixed(2)}-${Math.min(segment.end, video.duration).toFixed(2)}s] ${segment.text}`
			)
			.join('\n') || '(No speech detected; judge this source visually.)';

	return `VIDEO ${video.index}: ${video.name}\nSource path: ./sources/${video.path.split('/').at(-1)}\nDuration: ${video.duration.toFixed(2)} seconds\nTranscript path: ./transcript-${video.index}.json\nContact sheet path: ./contact-sheet-${video.index}.jpg\nTranscript:\n${transcript}`;
}

export async function createMovieEditorInput({ videos, vibe, targetMinutes, jobDirectory, music }) {
	const duration = targetMinutes
		? `Aim for roughly ${targetMinutes} minutes, but prefer a natural edit over the exact number.`
		: 'There is no target duration. Use as much or as little footage as the story needs.';
	const overview = await loadAgentImage('./music-analysis/overview.png', jobDirectory);
	const context = [
		{
			type: 'input_text',
			text: `${duration}\n\nAVAILABLE BACKGROUND MUSIC\n${musicSummary(music)}`
		},
		{ type: 'input_image', image_url: overview.imageUrl, detail: 'high' }
	];

	for (const video of videos) {
		context.push({ type: 'input_text', text: videoSummary(video) });
		context.push({
			type: 'input_image',
			image_url: await imageDataUrl(video.contactSheet),
			detail: 'high'
		});
	}

	return [
		{ type: 'message', role: 'developer', content: context },
		{ type: 'message', role: 'user', content: vibe }
	];
}
