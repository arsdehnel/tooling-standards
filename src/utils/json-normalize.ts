type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

export function isJsonFile(filename: string): boolean {
	return filename.endsWith('.json');
}

export function sortJsonKeys(obj: JsonValue): JsonValue {
	if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
		return obj;
	}

	const sorted: JsonObject = {};
	const keys = Object.keys(obj).sort();

	for (const key of keys) {
		sorted[key] = sortJsonKeys(obj[key]);
	}

	return sorted;
}

export function normalizeJson(content: string): string {
	try {
		const parsed: JsonValue = JSON.parse(content);
		const sorted = sortJsonKeys(parsed);
		return JSON.stringify(sorted, null, 2);
	} catch (_error) {
		// If it's not valid JSON, return as-is
		return content;
	}
}
