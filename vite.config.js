import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	for (const [name, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
		// Shell and deployment values should override local .env defaults.
		if (process.env[name] === undefined) process.env[name] = value;
	}

	return { plugins: [sveltekit()] };
});
