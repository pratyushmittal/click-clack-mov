import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
	js.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
	},
	{ ignores: ['.svelte-kit/', 'build/', '.vlogger/'] }
];
