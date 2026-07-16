import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

function sandboxValue(value) {
	return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function sandboxProfile(jobDirectory) {
	const homeDirectory = sandboxValue(os.homedir());
	const allowedDirectory = sandboxValue(path.resolve(jobDirectory));
	return `(version 1)
		(allow default)
		(deny network*)
		(deny file-read* (subpath "${homeDirectory}"))
		(allow file-read* (subpath "${allowedDirectory}"))
		(deny file-write* (subpath "${homeDirectory}"))
		(allow file-write* (subpath "${allowedDirectory}"))`;
}

function commandResult(stdout, stderr, exitCode = 0) {
	const output = [stdout?.trim(), stderr?.trim()].filter(Boolean).join('\n');
	return {
		exitCode,
		output: output.slice(-20_000) || '(command completed without output)'
	};
}

export async function runAgentBash(script, jobDirectory) {
	if (process.platform !== 'darwin') {
		throw new Error('The Bash agent currently requires the macOS sandbox-exec utility');
	}

	try {
		const result = await exec(
			'/usr/bin/sandbox-exec',
			['-p', sandboxProfile(jobDirectory), '/bin/bash', '-c', `set -euo pipefail\n${script}`],
			{
				cwd: jobDirectory,
				timeout: 15 * 60 * 1000,
				maxBuffer: 20 * 1024 * 1024,
				env: {
					// Prefer Homebrew's full build so text and subtitle filters are consistently available.
					PATH: [
						'/opt/homebrew/opt/ffmpeg-full/bin',
						'/usr/local/opt/ffmpeg-full/bin',
						process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin'
					].join(':'),
					HOME: jobDirectory,
					TMPDIR: jobDirectory,
					LANG: 'C.UTF-8'
				}
			}
		);
		return commandResult(result.stdout, result.stderr);
	} catch (err) {
		return commandResult(err.stdout, err.stderr || err.message, err.code || 1);
	}
}
