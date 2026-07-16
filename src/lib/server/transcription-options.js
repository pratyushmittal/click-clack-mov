export function transcriptionOptions(model) {
	if (model.endsWith('gpt-4o-transcribe-diarize')) {
		return { response_format: 'diarized_json', chunking_strategy: 'auto', temperature: 0 };
	}

	// These models return text without the timestamps required to cut source footage.
	if (model.endsWith('gpt-4o-transcribe') || model.endsWith('gpt-4o-mini-transcribe')) {
		throw new Error(
			`${model} does not provide segment timestamps; use gpt-4o-transcribe-diarize or a Whisper model`
		);
	}

	return { response_format: 'verbose_json', timestamp_granularities: ['segment'], temperature: 0 };
}
