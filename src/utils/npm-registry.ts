export async function fetchLatestNpmVersion(packageName: string): Promise<string> {
	const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`);
	if (!response.ok) throw new Error(`npm registry returned ${response.status} for ${packageName}`);
	const data = (await response.json()) as { version: string };
	return `^${data.version}`;
}
