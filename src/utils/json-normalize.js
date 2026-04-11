export function isJsonFile(filename) {
	return filename.endsWith('.json');
}

export function sortJsonKeys(obj) {
	if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
		return obj;
	}

	const sorted = {};
	const keys = Object.keys(obj).sort();

	for (const key of keys) {
		sorted[key] = sortJsonKeys(obj[key]);
	}

	return sorted;
}

export function normalizeJson(content) {
	try {
		const parsed = JSON.parse(content);
		const sorted = sortJsonKeys(parsed);
		return JSON.stringify(sorted, null, 2);
	} catch (_error) {
		// If it's not valid JSON, return as-is
		return content;
	}
}
