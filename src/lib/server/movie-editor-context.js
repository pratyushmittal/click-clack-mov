function musicIndex(music) {
	return music.tracks
		.map(
			(track, index) =>
				`${index + 1}. ${track.title}\n   Music: ${track.musicPath}\n   Analysis: ${track.analysisPath}\n   Timeline: ${track.timelinePath}`
		)
		.join('\n');
}

function videoIndex(video) {
	return `VIDEO ${video.index}: ${video.name}\nSource: ./sources/${video.path.split('/').at(-1)}\nDuration: ${video.duration.toFixed(2)} seconds\nTranscript: ./transcript-${video.index}.json\nContact sheet: ./contact-sheet-${video.index}.jpg`;
}

export function createMovieEditorInput({ videos, vibe, targetMinutes, music }) {
	const duration = targetMinutes
		? `Aim for roughly ${targetMinutes} minutes, but prefer a natural edit over the exact number.`
		: 'There is no target duration. Use as much or as little footage as the story needs.';
	const context = `${duration}

VIDEO FILE INDEX
${videos.map(videoIndex).join('\n\n')}

MUSIC FILE INDEX
Catalog: ./music-analysis/catalog.json
Overview: ./music-analysis/overview.png
Tracks: ./music/
Analysis: ./music-analysis/
${musicIndex(music)}`;

	return [
		{ type: 'message', role: 'developer', content: [{ type: 'input_text', text: context }] },
		{ type: 'message', role: 'user', content: vibe }
	];
}
