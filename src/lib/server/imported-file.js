import path from 'node:path';
import { z } from 'zod';

export const importsRoot = path.resolve('.vlogger/imports');
export const importIdSchema = z.string().uuid();
export const importedFileSchema = z.object({
	storedName: z.string().regex(/^[a-f0-9-]{36}-[a-zA-Z0-9._-]+$/),
	originalName: z.string().trim().min(1).max(255),
	size: z.number().nonnegative(),
	sha256: z.string().regex(/^[a-f0-9]{64}$/)
});

export function importedFilePath(importId, storedName) {
	return path.join(importsRoot, importId, storedName);
}
