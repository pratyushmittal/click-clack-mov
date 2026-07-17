import { expect, test } from '@playwright/test';
import { responseState } from '../../src/lib/server/responses-api.js';

test('keeps OpenRouter Responses requests stateless', () => {
	expect(responseState(true, 'response-1')).toEqual({ store: false });
});

test('stores direct OpenAI responses for later continuation', () => {
	expect(responseState(false, 'response-1')).toEqual({
		store: true,
		previous_response_id: 'response-1'
	});
});
