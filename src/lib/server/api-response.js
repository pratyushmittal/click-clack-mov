import { json } from '@sveltejs/kit';

export function apiSuccess(data, status = 200) {
	return json({ success: true, ...data }, { status });
}

export function apiError(error, status = 500) {
	return json({ success: false, error }, { status });
}

export function validationError(error) {
	return apiError(error.issues.map((issue) => issue.message).join(', '), 400);
}
