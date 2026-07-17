import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';

function historyValue(key, value) {
	// Data URLs duplicate generated media and can make a small history file enormous.
	if (typeof value !== 'string' || !value.startsWith('data:')) return value;
	const match = value.match(/^data:([^;,]+);base64,(.*)$/s);

	// Non-base64 data URLs are small enough to retain unchanged.
	if (!match) return value;
	return `data:${match[1]};base64,[omitted ${match[2].length} characters]`;
}

export function appendAgentHistory(jobDirectory, event) {
	return appendFile(
		path.join(jobDirectory, 'agent-history.jsonl'),
		`${JSON.stringify({ createdAt: new Date().toISOString(), ...event }, historyValue)}\n`
	);
}

export async function getLastAgentResponseId(jobDirectory) {
	const history = await readFile(path.join(jobDirectory, 'agent-history.jsonl'), 'utf8');
	const events = history.trim().split('\n').map(JSON.parse);

	for (let index = events.length - 1; index >= 0; index -= 1) {
		if (events[index].type === 'model_response' && events[index].data?.id) {
			return events[index].data.id;
		}
	}

	throw new Error('The original editing conversation is not available for export');
}
