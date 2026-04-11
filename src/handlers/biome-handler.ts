import { fetchFile } from '../github/fetch.js';
import { formatWithBiome } from '../utils/format.js';
import { formatWithPrettier } from '../utils/format-prettier.js';
import type { FileHandler, PushContext, PushResult } from './base-handler.js';

export class BiomeHandler implements FileHandler {
	async beforePush(content: string, context: PushContext): Promise<PushResult> {
		// 1. Format the biome.json with biome
		const formatted = await formatWithBiome(content, 'biome.json');

		// 2. Extract version from $schema URL
		const json = JSON.parse(formatted) as { $schema?: string };
		const schemaUrl = json.$schema;

		if (!schemaUrl) {
			return { content: formatted };
		}

		// Extract version from schema URL like "https://biomejs.dev/schemas/2.4.11/schema.json"
		const versionMatch = schemaUrl.match(/\/schemas\/([0-9.]+)\//);
		if (!versionMatch) {
			return { content: formatted };
		}

		const schemaVersion = versionMatch[1];

		// 3. Fetch package.json from the remote repo
		let packageJsonContent: string;
		try {
			const fetched = await fetchFile(context.owner, context.repo, 'package.json');
			packageJsonContent = fetched.content;
		} catch (error) {
			// If package.json doesn't exist or can't be fetched, just push biome.json
			return {
				content: formatted,
				warnings: ['Could not fetch package.json - biome version will not be updated'],
			};
		}

		// 4. Check if biome version needs updating
		const pkg = JSON.parse(packageJsonContent) as {
			devDependencies?: Record<string, string>;
			dependencies?: Record<string, string>;
		};

		const currentDevVersion = pkg.devDependencies?.['@biomejs/biome'];
		const currentDepVersion = pkg.dependencies?.['@biomejs/biome'];
		const targetVersion = `^${schemaVersion}`;

		// Check if update is needed
		const needsUpdate = currentDevVersion !== targetVersion && currentDepVersion !== targetVersion;

		if (!needsUpdate) {
			return { content: formatted };
		}

		// 5. Update the biome version in package.json
		if (currentDevVersion) {
			pkg.devDependencies!['@biomejs/biome'] = targetVersion;
		} else if (currentDepVersion) {
			pkg.dependencies!['@biomejs/biome'] = targetVersion;
		} else {
			// Biome is not in package.json, add it to devDependencies
			if (!pkg.devDependencies) {
				pkg.devDependencies = {};
			}
			pkg.devDependencies['@biomejs/biome'] = targetVersion;
		}

		// Format package.json with prettier (which includes the packagejson plugin)
		const updatedPackageJsonRaw = JSON.stringify(pkg, null, 2) + '\n';
		const updatedPackageJson = await formatWithPrettier(updatedPackageJsonRaw, 'package.json');

		return {
			content: formatted,
			additionalFiles: [
				{
					path: 'package.json',
					content: updatedPackageJson,
					reason: `Update @biomejs/biome to ${targetVersion} to match schema version`,
				},
			],
		};
	}
}
