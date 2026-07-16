import { appendFile } from 'node:fs/promises';
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
