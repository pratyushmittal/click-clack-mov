import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { runAgentBash } from '$lib/server/agent-bash.js';
import { appendAgentHistory, getLastAgentResponseId } from '$lib/server/agent-history.js';
import { loadAgentImages } from '$lib/server/agent-image.js';
import { downloadAgentSound } from '$lib/server/agent-sound.js';
import movieEditorPrompt from '$lib/server/prompts/movie-editor.md?raw';
import movieEditorExportPrompt from '$lib/server/prompts/movie-editor-export.md?raw';
import { updateJobStatus } from '$lib/server/job-status.js';
import { getOrCreateTranscription } from '$lib/server/transcription-cache.js';
import { createMovieEditorInput } from '$lib/server/movie-editor-context.js';
import { transcriptionOptions } from '$lib/server/transcription-options.js';
import { responseState } from '$lib/server/responses-api.js';

function getMaxAgentTurns() {
	const configuredTurns = Number.parseInt(process.env.EDITOR_MAX_TURNS || '', 10);
	// A ceiling prevents a broken tool loop from running indefinitely.
	return Number.isInteger(configuredTurns) ? Math.max(4, Math.min(configuredTurns, 128)) : 80;
}

function getSettings() {
	const apiKey = process.env.LLM_API_KEY;
	if (!apiKey) throw new Error('Set LLM_API_KEY in .env');

	const openRouter = apiKey.startsWith('sk-or-');
	return {
		apiKey,
		openRouter,
		baseURL: process.env.LLM_BASE_URL || (openRouter ? 'https://openrouter.ai/api/v1' : undefined),
		transcriptionModel:
			process.env.TRANSCRIPTION_MODEL ||
			(openRouter ? 'openai/whisper-large-v3-turbo' : 'whisper-1'),
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

const editFormat = {
	name: 'vlog_edit',
	description: 'The exact source clips rendered into the final vlog.',
	schema: {
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
	}
};

const exportFormat = {
	name: 'premiere_export',
	description: 'The completed editable project export.',
	schema: {
		type: 'object',
		additionalProperties: false,
		required: ['summary'],
		properties: { summary: { type: 'string' } }
	}
};

function imageToolOutput({ images, errors }) {
	const failures = errors.length
		? [
				{
					type: 'input_text',
					text: `Could not load: ${errors
						.map((error) => `${error.path || 'image'} (${error.message})`)
						.join(', ')}. Continue with the loaded images or generate replacements.`
				}
			]
		: [];
	return [
		...images.flatMap((image) => [
			{ type: 'input_text', text: `Loaded ${image.path}.` },
			{ type: 'input_image', image_url: image.imageUrl, detail: 'high' }
		]),
		...failures
	];
}

const agentTools = {
	run_bash: {
		definition: {
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
		},
		async run(args, jobDirectory) {
			const result = await runAgentBash(args.script, jobDirectory);
			return { result, output: JSON.stringify({ intent: args.intent, ...result }) };
		}
	},
	load_images: {
		definition: {
			type: 'function',
			name: 'load_images',
			description:
				'Load one to six JPEG, PNG, or WebP files from the current editing job as visual input. Use it to review contact sheets, music timelines, or frames generated during editing.',
			strict: true,
			parameters: {
				type: 'object',
				additionalProperties: false,
				required: ['paths', 'intent'],
				properties: {
					paths: {
						type: 'array',
						minItems: 1,
						maxItems: 6,
						items: { type: 'string' },
						description: 'Paths relative to the current job directory.'
					},
					intent: {
						type: 'string',
						description: 'A concise user-facing summary of why these images are being inspected.'
					}
				}
			}
		},
		async run(args, jobDirectory) {
			let result;
			try {
				result = await loadAgentImages(args.paths, jobDirectory);
			} catch (err) {
				// Tool input mistakes should return to the agent instead of aborting the edit.
				result = { images: [], errors: [{ message: err?.message || String(err) }] };
			}
			return { result, output: imageToolOutput(result) };
		}
	},
	download_sound: {
		definition: {
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
		},
		async run(args, jobDirectory) {
			let result;
			try {
				result = await downloadAgentSound(args, jobDirectory);
			} catch (err) {
				// Network and catalog failures should not abort an otherwise viable movie edit.
				result = { error: err?.message || String(err) };
			}
			return { result, output: JSON.stringify(result) };
		}
	}
};

function toolDefinitions(names) {
	return names.map((name) => agentTools[name].definition);
}

async function executeAgentTool(toolCall, args, jobDirectory) {
	const tool = agentTools[toolCall.name];
	if (!tool) throw new Error('The editor requested an unknown tool');

	const { result, output } = await tool.run(args, jobDirectory);
	return {
		result,
		output: { type: 'function_call_output', call_id: toolCall.call_id, output }
	};
}

function responseOutputText(result) {
	return (
		result.output_text ||
		(result.output || [])
			.flatMap((item) => item.content || [])
			.find((item) => item.type === 'output_text')?.text
	);
}

function userMessage(text) {
	return { type: 'message', role: 'user', content: [{ type: 'input_text', text }] };
}

async function createAgentResponse(settings, jobDirectory, step, agent, input, previousResponseId) {
	const request = {
		model: settings.editorModel,
		instructions: agent.instructions,
		input,
		tools: toolDefinitions(agent.toolNames),
		tool_choice: 'auto',
		parallel_tool_calls: false,
		max_output_tokens: 16_000,
		...responseState(settings.openRouter, previousResponseId),
		text: { format: { type: 'json_schema', strict: true, ...agent.format } }
	};
	await appendAgentHistory(jobDirectory, { type: `${agent.events.model}_request`, step, request });

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
			type: `${agent.events.model}_response`,
			step,
			httpStatus: result.status,
			raw: responseText
		});
		throw new Error('The agent returned an invalid response');
	}
	await appendAgentHistory(jobDirectory, {
		type: `${agent.events.model}_response`,
		step,
		httpStatus: result.status,
		data
	});
	if (!result.ok) {
		const detail = data.metadata?.raw;
		throw new Error(
			[typeof data.error === 'string' ? data.error : data.error?.message, detail]
				.filter(Boolean)
				.join(': ') || 'The agent failed'
		);
	}
	return data;
}

/**
 * Drives one tool-calling agent until it produces `agent.artifact` and its structured
 * result. Both the editing and export agents share this loop; they differ only in the
 * prompt, schema, tools, required artifact, and history event names.
 */
async function runAgentLoop(settings, jobDirectory, agent) {
	const maxTurns = getMaxAgentTurns();
	// A stateful provider replays earlier turns from previous_response_id, so each request
	// only carries what is new. A stateless one must resend the whole conversation.
	const stateful = agent.stateful && !settings.openRouter;
	let previousResponseId = stateful ? agent.previousResponseId : undefined;
	let input = agent.input;

	for (let step = 0; step < maxTurns; step += 1) {
		const result = await createAgentResponse(
			settings,
			jobDirectory,
			step,
			agent,
			input,
			previousResponseId
		);
		if (stateful) previousResponseId = result.id;
		const output = result.output || [];
		if (stateful) input = [];
		else input.push(...output);

		const toolCalls = output.filter((item) => item.type === 'function_call');
		if (toolCalls.length) {
			for (const toolCall of toolCalls) {
				const args = JSON.parse(toolCall.arguments);
				await appendAgentHistory(jobDirectory, {
					type: `${agent.events.tool}_call`,
					step,
					toolCall,
					arguments: args
				});
				await updateJobStatus(jobDirectory, {
					phase: agent.phase,
					message: args.intent,
					intent: true
				});

				const { result: toolResult, output: toolOutput } = await executeAgentTool(
					toolCall,
					args,
					jobDirectory
				);
				await appendAgentHistory(jobDirectory, {
					type: `${agent.events.tool}_result`,
					step,
					callId: toolCall.call_id,
					result: toolResult,
					input: toolOutput
				});
				input.push(toolOutput);
			}
			continue;
		}

		try {
			await stat(path.join(jobDirectory, agent.artifact));
		} catch {
			const reminder = userMessage(
				`The required ./${agent.artifact} does not exist yet. ${agent.reminder}`
			);
			await appendAgentHistory(jobDirectory, {
				type: `${agent.events.conversation}_user_message`,
				step,
				input: reminder
			});
			input.push(reminder);
			continue;
		}

		if (agent.readyStatus) await updateJobStatus(jobDirectory, agent.readyStatus);

		const outputText = responseOutputText(result);
		if (!outputText) throw new Error(agent.missingOutputError);
		const parsed = JSON.parse(outputText);
		await appendAgentHistory(jobDirectory, {
			type: `${agent.events.conversation}_complete`,
			step,
			responseId: previousResponseId,
			result: parsed
		});
		return parsed;
	}

	throw new Error(`The ${agent.label} exceeded its maximum of ${maxTurns} model turns`);
}

async function runAgent(settings, jobDirectory, agent) {
	try {
		return await runAgentLoop(settings, jobDirectory, agent);
	} catch (err) {
		await agent.onError?.();
		await appendAgentHistory(jobDirectory, {
			type: `${agent.events.conversation}_error`,
			message: err?.message || String(err),
			stack: err?.stack
		});
		throw err;
	}
}

export async function runEditingAgent(videos, vibe, targetMinutes, jobDirectory, music, fonts) {
	const settings = getSettings();
	const agent = {
		label: 'editing agent',
		instructions: movieEditorPrompt.trim(),
		input: createMovieEditorInput({ videos, vibe, targetMinutes, music, fonts }),
		format: editFormat,
		toolNames: ['run_bash', 'load_images', 'download_sound'],
		phase: 'editing',
		artifact: 'vlogger-cut.mp4',
		reminder: 'Use run_bash to create it before returning the final edit.',
		readyStatus: {
			phase: 'finalizing',
			message: 'Checking the rendered movie and edit decisions'
		},
		missingOutputError: 'The editor did not return its edit decisions',
		events: { model: 'model', tool: 'tool', conversation: 'conversation' }
	};

	await appendAgentHistory(jobDirectory, {
		type: 'conversation_start',
		model: settings.editorModel,
		maxTurns: getMaxAgentTurns()
	});
	await updateJobStatus(jobDirectory, {
		phase: 'editing',
		message: 'Reviewing footage and background music'
	});

	return runAgent(settings, jobDirectory, agent);
}

export async function runEditorExportAgent(jobDirectory) {
	const settings = getSettings();
	// A stateless provider cannot resume the editing conversation, so the export agent
	// recovers the original Bash commands from the job's history file instead.
	const recovery = settings.openRouter
		? ' Read ./agent-history.jsonl to recover the original editing conversation and Bash commands.'
		: '';
	const previousResponseId = settings.openRouter
		? undefined
		: await getLastAgentResponseId(jobDirectory);
	const agent = {
		label: 'export agent',
		instructions: movieEditorExportPrompt.trim(),
		input: [
			userMessage(
				`Create a complete editable project export of this exact rough cut for Adobe Premiere.${recovery} Read ./premiere-xml-reference.md for the XML authoring specification and validation checklist.`
			)
		],
		format: exportFormat,
		toolNames: ['run_bash'],
		phase: 'exporting',
		artifact: 'premiere-export.zip',
		reminder: 'Use run_bash to create and validate it before finishing.',
		missingOutputError: 'The editor did not describe the project export',
		events: { model: 'export_model', tool: 'export_tool', conversation: 'export' },
		stateful: true,
		previousResponseId,
		// A failed export leaves the already-rendered first cut as the job's final state.
		onError: () =>
			updateJobStatus(jobDirectory, { phase: 'complete', message: 'Your first cut is ready' })
	};

	await updateJobStatus(jobDirectory, {
		phase: 'exporting',
		message: 'Preparing the editable timeline'
	});
	await appendAgentHistory(jobDirectory, {
		type: 'export_start',
		model: settings.editorModel,
		previousResponseId,
		input: agent.input
	});

	const exported = await runAgent(settings, jobDirectory, agent);
	await updateJobStatus(jobDirectory, {
		phase: 'complete',
		message: 'Your editable project is ready'
	});
	return exported;
}
