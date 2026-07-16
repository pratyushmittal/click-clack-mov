import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import OpenAI from 'openai';
import { runAgentBash } from '$lib/server/agent-bash.js';
import { appendAgentHistory } from '$lib/server/agent-history.js';
import { loadAgentImage } from '$lib/server/agent-image.js';
import { downloadAgentSound } from '$lib/server/agent-sound.js';
import movieEditorPrompt from '$lib/server/prompts/movie-editor.md?raw';
import { updateJobStatus } from '$lib/server/job-status.js';
import { getOrCreateTranscription } from '$lib/server/transcription-cache.js';
import { createMovieEditorInput } from '$lib/server/movie-editor-context.js';
import { transcriptionOptions } from '$lib/server/transcription-options.js';

function getMaxAgentTurns() {
	const configuredTurns = Number.parseInt(process.env.EDITOR_MAX_TURNS || '', 10);
	// A ceiling prevents a broken tool loop from running indefinitely.
	return Number.isInteger(configuredTurns) ? Math.max(4, Math.min(configuredTurns, 64)) : 50;
}

function getSettings() {
	const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
	if (!apiKey) throw new Error('Set OPENAI_API_KEY or LLM_API_KEY in .env');

	const openRouter = apiKey.startsWith('sk-or-');
	return {
		apiKey,
		openRouter,
		baseURL: process.env.LLM_BASE_URL || (openRouter ? 'https://openrouter.ai/api/v1' : undefined),
		transcriptionModel:
			process.env.TRANSCRIPTION_MODEL ||
			(openRouter ? 'openai/whisper-large-v3' : 'gpt-4o-transcribe-diarize'),
		editorModel: process.env.EDITOR_MODEL || (openRouter ? 'openai/gpt-5.6-sol' : 'gpt-5.6-sol')
	};
}

async function transcribeChunk(chunkPath, settings) {
	const options = transcriptionOptions(settings.transcriptionModel);
	if (!settings.openRouter) {
		const client = new OpenAI({ apiKey: settings.apiKey, baseURL: settings.baseURL });
		return client.audio.transcriptions.create({
			file: createReadStream(chunkPath),
			model: settings.transcriptionModel,
			...options
		});
	}

	// OpenRouter accepts base64 audio and passes Whisper timestamp options through to its provider.
	const result = await fetch(`${settings.baseURL}/audio/transcriptions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${settings.apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'http://localhost:5173',
			'X-OpenRouter-Title': 'Click Clack Mov'
		},
		body: JSON.stringify({
			model: settings.transcriptionModel,
			input_audio: { data: (await readFile(chunkPath)).toString('base64'), format: 'mp3' },
			...options
		})
	});
	const data = await result.json();
	if (!result.ok) throw new Error(data.error?.message || data.error || 'Transcription failed');
	return data;
}

async function transcribeBatch(chunks, settings) {
	return Promise.all(
		chunks.map(async (chunk) => {
			const result = await transcribeChunk(chunk.path, settings);
			return (result.segments || [])
				.filter((segment) => segment.text?.trim())
				.map((segment) => ({
					start: chunk.offset + segment.start,
					end: chunk.offset + segment.end,
					text: segment.text.trim(),
					...(segment.speaker ? { speaker: segment.speaker } : {})
				}));
		})
	);
}

async function transcribeChunks(chunks, settings) {
	const concurrency = Math.max(1, Math.min(Number(process.env.TRANSCRIPTION_CONCURRENCY) || 2, 4));
	const segments = [];

	for (let index = 0; index < chunks.length; index += concurrency) {
		segments.push(
			...(await transcribeBatch(chunks.slice(index, index + concurrency), settings)).flat()
		);
	}

	return segments.sort((left, right) => left.start - right.start);
}

export function transcribeVideo(sourceHash, createChunks) {
	const settings = getSettings();
	return getOrCreateTranscription(sourceHash, settings.transcriptionModel, async () =>
		transcribeChunks(await createChunks(), settings)
	);
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
				required: ['fileIndex', 'start', 'end', 'speed', 'reason'],
				properties: {
					fileIndex: { type: 'integer' },
					start: { type: 'number' },
					end: { type: 'number' },
					speed: { type: 'number', minimum: 0.25, maximum: 8 },
					reason: { type: 'string' }
				}
			}
		}
	}
};

const imageTool = {
	type: 'function',
	name: 'load_image',
	description:
		'Load a JPEG, PNG, or WebP image from the current editing job as visual input. Use this only for a closer frame or image created during editing; the initial contact sheets are already visible.',
	strict: true,
	parameters: {
		type: 'object',
		additionalProperties: false,
		required: ['path', 'intent'],
		properties: {
			path: { type: 'string', description: 'A path relative to the current job directory.' },
			intent: {
				type: 'string',
				description: 'A concise user-facing summary of why this image is being inspected.'
			}
		}
	}
};

const soundTool = {
	type: 'function',
	name: 'download_sound',
	description:
		'Search Openverse for one relevant CC0 sound effect, download it into the current job, and return its local path and provenance. Use only when a specific effect materially improves the edit. This tool does not download background music and allows at most three unique sounds per movie.',
	strict: true,
	parameters: {
		type: 'object',
		additionalProperties: false,
		required: ['query', 'maxDurationSeconds', 'intent'],
		properties: {
			query: {
				type: 'string',
				description: 'A concise description of the sound effect, such as soft cinematic whoosh.'
			},
			maxDurationSeconds: {
				type: 'number',
				minimum: 0.25,
				maximum: 30,
				description: 'The longest acceptable sound effect in seconds.'
			},
			intent: {
				type: 'string',
				description: 'A concise user-facing summary of why this sound is being downloaded.'
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
		required: ['script', 'intent'],
		properties: {
			script: { type: 'string', description: 'The complete Bash script to execute.' },
			intent: {
				type: 'string',
				description:
					'A concise user-facing summary of what this tool call is trying to accomplish. Do not include hidden chain-of-thought.'
			}
		}
	}
};

async function createAgentResponse(settings, instructions, input, jobDirectory, step) {
	const request = {
		model: settings.editorModel,
		instructions,
		input,
		tools: [bashTool, imageTool, soundTool],
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
	};
	await appendAgentHistory(jobDirectory, { type: 'model_request', step, request });

	const baseURL = settings.baseURL || 'https://api.openai.com/v1';
	const result = await fetch(`${baseURL}/responses`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${settings.apiKey}`,
			'Content-Type': 'application/json',
			...(settings.openRouter
				? { 'HTTP-Referer': 'http://localhost:5173', 'X-OpenRouter-Title': 'Click Clack Mov' }
				: {})
		},
		body: JSON.stringify(request)
	});
	const responseText = await result.text();
	let data;
	try {
		data = JSON.parse(responseText);
	} catch {
		// Upstream failures can return HTML or plain text instead of JSON.
		await appendAgentHistory(jobDirectory, {
			type: 'model_response',
			step,
			httpStatus: result.status,
			raw: responseText
		});
		throw new Error('The editing agent returned an invalid response');
	}
	await appendAgentHistory(jobDirectory, {
		type: 'model_response',
		step,
		httpStatus: result.status,
		data
	});
	if (!result.ok) throw new Error(data.error?.message || data.error || 'The editing agent failed');
	return data;
}

export async function runEditingAgent(videos, vibe, targetMinutes, jobDirectory, music) {
	const settings = getSettings();
	const maxTurns = getMaxAgentTurns();
	const instructions = movieEditorPrompt.trim();
	const input = await createMovieEditorInput({
		videos,
		vibe,
		targetMinutes,
		jobDirectory,
		music
	});
	await appendAgentHistory(jobDirectory, {
		type: 'conversation_start',
		model: settings.editorModel,
		maxTurns
	});

	await updateJobStatus(jobDirectory, {
		phase: 'editing',
		message: 'Reviewing footage and background music'
	});

	try {
		for (let step = 0; step < maxTurns; step += 1) {
			const result = await createAgentResponse(settings, instructions, input, jobDirectory, step);
			input.push(...(result.output || []));
			const toolCalls = (result.output || []).filter((item) => item.type === 'function_call');

			if (toolCalls.length) {
				for (const toolCall of toolCalls) {
					const args = JSON.parse(toolCall.arguments);
					await appendAgentHistory(jobDirectory, {
						type: 'tool_call',
						step,
						toolCall,
						arguments: args
					});
					await updateJobStatus(jobDirectory, {
						phase: 'editing',
						message: args.intent,
						intent: true
					});

					let toolResult;
					let output;
					if (toolCall.name === 'run_bash') {
						toolResult = await runAgentBash(args.script, jobDirectory);
						output = {
							type: 'function_call_output',
							call_id: toolCall.call_id,
							output: JSON.stringify({ intent: args.intent, ...toolResult })
						};
					} else if (toolCall.name === 'load_image') {
						toolResult = await loadAgentImage(args.path, jobDirectory);
						output = {
							type: 'function_call_output',
							call_id: toolCall.call_id,
							output: [
								{ type: 'input_text', text: `Loaded ${toolResult.path}.` },
								{ type: 'input_image', image_url: toolResult.imageUrl, detail: 'high' }
							]
						};
					} else if (toolCall.name === 'download_sound') {
						try {
							toolResult = await downloadAgentSound(args, jobDirectory);
						} catch (err) {
							// Network and catalog failures should not abort an otherwise viable movie edit.
							toolResult = { error: err?.message || String(err) };
						}
						output = {
							type: 'function_call_output',
							call_id: toolCall.call_id,
							output: JSON.stringify(toolResult)
						};
					} else {
						throw new Error('The editor requested an unknown tool');
					}

					await appendAgentHistory(jobDirectory, {
						type: 'tool_result',
						step,
						callId: toolCall.call_id,
						result: toolResult,
						input: output
					});
					input.push(output);
				}
				continue;
			}

			try {
				await stat(`${jobDirectory}/vlogger-cut.mp4`);
			} catch {
				const reminder = {
					type: 'message',
					role: 'user',
					content: [
						{
							type: 'input_text',
							text: 'The required ./vlogger-cut.mp4 does not exist yet. Use run_bash to create it before returning the final edit.'
						}
					]
				};
				await appendAgentHistory(jobDirectory, {
					type: 'user_message',
					step,
					input: reminder
				});
				input.push(reminder);
				continue;
			}

			await updateJobStatus(jobDirectory, {
				phase: 'finalizing',
				message: 'Checking the rendered movie and edit decisions'
			});

			const outputText =
				result.output_text ||
				(result.output || [])
					.flatMap((item) => item.content || [])
					.find((item) => item.type === 'output_text')?.text;
			if (!outputText) throw new Error('The editor did not return its edit decisions');
			const edit = JSON.parse(outputText);
			await appendAgentHistory(jobDirectory, { type: 'conversation_complete', step, edit });
			return edit;
		}

		throw new Error(`The editing agent exceeded its maximum of ${maxTurns} model turns`);
	} catch (err) {
		await appendAgentHistory(jobDirectory, {
			type: 'conversation_error',
			message: err?.message || String(err),
			stack: err?.stack
		});
		throw err;
	}
}
