import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import OpenAI from 'openai';
import { imageDataUrl } from '$lib/server/media.js';
import { runAgentBash } from '$lib/server/agent-bash.js';

function getSettings() {
	const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
	if (!apiKey) throw new Error('Set OPENAI_API_KEY or LLM_API_KEY in .env');

	const openRouter = apiKey.startsWith('sk-or-');
	return {
		apiKey,
		openRouter,
		baseURL: process.env.LLM_BASE_URL || (openRouter ? 'https://openrouter.ai/api/v1' : undefined),
		transcriptionModel:
			process.env.TRANSCRIPTION_MODEL || (openRouter ? 'openai/whisper-1' : 'whisper-1'),
		editorModel: process.env.EDITOR_MODEL || (openRouter ? 'openai/gpt-5.6-terra' : 'gpt-5.6-terra')
	};
}

async function transcribeChunk(chunkPath, settings) {
	if (!settings.openRouter) {
		const client = new OpenAI({ apiKey: settings.apiKey, baseURL: settings.baseURL });
		return client.audio.transcriptions.create({
			file: createReadStream(chunkPath),
			model: settings.transcriptionModel,
			response_format: 'verbose_json',
			timestamp_granularities: ['segment']
		});
	}

	// OpenRouter accepts base64 audio and passes Whisper timestamp options through to OpenAI.
	const result = await fetch(`${settings.baseURL}/audio/transcriptions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${settings.apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'http://localhost:5173',
			'X-OpenRouter-Title': 'Vlogger'
		},
		body: JSON.stringify({
			model: settings.transcriptionModel,
			input_audio: { data: (await readFile(chunkPath)).toString('base64'), format: 'mp3' },
			response_format: 'verbose_json',
			timestamp_granularities: ['segment']
		})
	});
	const data = await result.json();
	if (!result.ok) throw new Error(data.error?.message || data.error || 'Transcription failed');
	return data;
}

export async function transcribeChunks(chunks) {
	const settings = getSettings();
	const segments = [];

	for (const chunk of chunks) {
		const result = await transcribeChunk(chunk.path, settings);
		for (const segment of result.segments || []) {
			const text = segment.text?.trim();
			if (text) {
				segments.push({
					start: chunk.offset + segment.start,
					end: chunk.offset + segment.end,
					text
				});
			}
		}
	}

	return segments;
}

const selectionSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['title', 'summary', 'clips'],
	properties: {
		title: { type: 'string' },
		summary: { type: 'string' },
		clips: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['fileIndex', 'start', 'end', 'reason'],
				properties: {
					fileIndex: { type: 'integer' },
					start: { type: 'number' },
					end: { type: 'number' },
					reason: { type: 'string' }
				}
			}
		}
	}
};

const bashTool = {
	type: 'function',
	name: 'run_bash',
	description:
		'Run a Bash script inside the current editing job. Use FFmpeg, FFprobe, and standard shell utilities to inspect, trim, normalize, and assemble the movie. The sandbox can only read and write inside this job and cannot access the network.',
	strict: true,
	parameters: {
		type: 'object',
		additionalProperties: false,
		required: ['script', 'purpose'],
		properties: {
			script: { type: 'string', description: 'The complete Bash script to execute.' },
			purpose: { type: 'string', description: 'A short explanation of what the script does.' }
		}
	}
};

async function createAgentResponse(settings, input) {
	const baseURL = settings.baseURL || 'https://api.openai.com/v1';
	const result = await fetch(`${baseURL}/responses`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${settings.apiKey}`,
			'Content-Type': 'application/json',
			...(settings.openRouter
				? { 'HTTP-Referer': 'http://localhost:5173', 'X-OpenRouter-Title': 'Vlogger' }
				: {})
		},
		body: JSON.stringify({
			model: settings.editorModel,
			input,
			tools: [bashTool],
			tool_choice: 'auto',
			parallel_tool_calls: false,
			max_output_tokens: 16_000,
			text: {
				format: {
					type: 'json_schema',
					name: 'vlog_edit',
					description: 'The exact source clips rendered into the final vlog.',
					strict: true,
					schema: selectionSchema
				}
			}
		})
	});
	const data = await result.json();
	if (!result.ok) throw new Error(data.error?.message || data.error || 'The editing agent failed');
	return data;
}

export async function runEditingAgent(videos, vibe, targetMinutes, jobDirectory) {
	const settings = getSettings();
	const content = [
		{
			type: 'input_text',
			text: `You are an autonomous vlog editor with a Bash tool. Create one coherent first cut close to ${targetMinutes} minutes.\nDesired vibe and selection criteria from the user: ${vibe}\n\nSelect footage solely on how well it serves the user's vibe, story, and target length. You do not need to use every source video.\n\nYou must use run_bash to inspect and edit the source files. Create the final movie at exactly ./vlogger-cut.mp4. Source videos are under ./sources. Timestamped transcripts are available as ./transcript-N.json, and contact sheets as ./contact-sheet-N.jpg. Never modify source files. You may create any intermediate files inside this job. Use FFmpeg/FFprobe to trim, normalize, and join the selected footage. The final MP4 should use broadly compatible H.264 video, AAC audio, yuv420p pixel format, and +faststart. Handle clips without audio by adding silence when needed.\n\nAfter the movie exists, return the title, summary, and the exact source clip boundaries used. Clip timestamps must stay within their source duration. The returned clips must match the rendered movie.`
		}
	];

	for (const video of videos) {
		content.push({
			type: 'input_text',
			text: `VIDEO ${video.index}: ${video.name}\nSource path: ./sources/${video.path.split('/').at(-1)}\nDuration: ${video.duration.toFixed(2)} seconds\nTranscript path: ./transcript-${video.index}.json\nContact sheet path: ./contact-sheet-${video.index}.jpg\nTranscript:\n${video.segments.map((segment) => `[${segment.start.toFixed(2)}-${Math.min(segment.end, video.duration).toFixed(2)}s] ${segment.text}`).join('\n') || '(No speech detected; judge this source visually.)'}`
		});
		content.push({
			type: 'input_image',
			image_url: await imageDataUrl(video.contactSheet),
			detail: 'high'
		});
	}

	const input = [{ type: 'message', role: 'user', content }];
	for (let step = 0; step < 12; step += 1) {
		const result = await createAgentResponse(settings, input);
		input.push(...(result.output || []));
		const toolCalls = (result.output || []).filter((item) => item.type === 'function_call');

		if (toolCalls.length) {
			for (const toolCall of toolCalls) {
				if (toolCall.name !== 'run_bash') throw new Error('The editor requested an unknown tool');
				const args = JSON.parse(toolCall.arguments);
				const toolResult = await runAgentBash(args.script, jobDirectory);
				input.push({
					type: 'function_call_output',
					call_id: toolCall.call_id,
					output: JSON.stringify({ purpose: args.purpose, ...toolResult })
				});
			}
			continue;
		}

		try {
			await stat(`${jobDirectory}/vlogger-cut.mp4`);
		} catch {
			input.push({
				type: 'message',
				role: 'user',
				content: [
					{
						type: 'input_text',
						text: 'The required ./vlogger-cut.mp4 does not exist yet. Use run_bash to create it before returning the final edit.'
					}
				]
			});
			continue;
		}

		const outputText =
			result.output_text ||
			(result.output || [])
				.flatMap((item) => item.content || [])
				.find((item) => item.type === 'output_text')?.text;
		if (!outputText) throw new Error('The editor did not return its edit decisions');
		return JSON.parse(outputText);
	}

	throw new Error('The editing agent exceeded its maximum number of Bash steps');
}
