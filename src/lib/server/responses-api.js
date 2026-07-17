export function responseState(openRouter, previousResponseId) {
	// OpenRouter's Responses API is stateless and currently accepts only store=false.
	if (openRouter) return { store: false };
	return {
		store: true,
		...(previousResponseId ? { previous_response_id: previousResponseId } : {})
	};
}
