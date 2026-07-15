export function createLogger(category) {
	const write = (level, message, detail) => {
		const parts = [`[${category}]`, message];
		if (detail !== undefined) parts.push(detail);
		console[level](...parts);
	};

	return {
		debug: (message, detail) => process.env.DEBUG === 'true' && write('debug', message, detail),
		info: (message, detail) => write('info', message, detail),
		warn: (message, detail) => write('warn', message, detail),
		error: (message, detail) => write('error', message, detail)
	};
}
