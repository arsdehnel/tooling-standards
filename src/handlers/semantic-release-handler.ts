import { fetchFile } from "../github/fetch.js";
import { formatWithBiome } from "../utils/format.js";
import { formatWithPrettier } from "../utils/format-prettier.js";
import { detectPackageManager, generateLockfile } from "../utils/lockfile.js";
import { fetchLatestNpmVersion } from "../utils/npm-registry.js";
import type { FileHandler, PushContext, PushResult } from "./base-handler.js";

export class SemanticReleaseHandler implements FileHandler {
	async beforePush(content: string, context: PushContext): Promise<PushResult> {
		// 1. Format the JS config file with Biome
		const formatted = await formatWithBiome(content, context.filename);

		// 2. Extract plugins from the JS config
		const plugins = this.extractPlugins(content);

		if (plugins.length === 0) {
			return { content: formatted };
		}

		// 3. Fetch package.json from the remote repo
		let packageJsonContent: string;
		try {
			const fetched = await fetchFile(context.owner, context.repo, "package.json");
			packageJsonContent = fetched.content;
		} catch (error) {
			return {
				content: formatted,
				warnings: ["Could not fetch package.json - semantic-release dependencies will not be updated"],
			};
		}

		// 4. Find missing dependencies
		const pkg = JSON.parse(packageJsonContent) as {
			devDependencies?: Record<string, string>;
			dependencies?: Record<string, string>;
		};

		if (!pkg.devDependencies) {
			pkg.devDependencies = {};
		}

		const allDeps = ["semantic-release", ...plugins];
		if (content.includes("conventionalcommits")) {
			allDeps.push("conventional-changelog-conventionalcommits");
		}

		const missingDeps = allDeps.filter(dep => !pkg.devDependencies?.[dep] && !pkg.dependencies?.[dep]);

		if (missingDeps.length === 0) {
			return { content: formatted };
		}

		// 5. Fetch latest versions for missing deps and add them
		const warnings: string[] = [];
		for (const dep of missingDeps) {
			try {
				const version = await fetchLatestNpmVersion(dep);
				pkg.devDependencies[dep] = version;
			} catch (error) {
				warnings.push(`Could not fetch latest version for ${dep} - skipping`);
			}
		}

		// If all fetches failed, nothing to update
		const anyAdded = missingDeps.some(dep => pkg.devDependencies?.[dep]);
		if (!anyAdded) {
			return { content: formatted, warnings };
		}

		// 6. Format package.json with prettier
		const updatedPackageJsonRaw = JSON.stringify(pkg, null, 2) + "\n";
		const updatedPackageJson = await formatWithPrettier(updatedPackageJsonRaw, "package.json");

		const additionalFiles: Array<{ path: string; content: string; reason: string }> = [
			{
				path: "package.json",
				content: updatedPackageJson,
				reason: "Add missing semantic-release dependencies",
			},
		];

		// 7. Try to detect and update lockfile
		const lockfileNames = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"];
		let lockfileDetected = false;

		for (const lockfileName of lockfileNames) {
			try {
				const existingLockfile = await fetchFile(context.owner, context.repo, lockfileName);
				lockfileDetected = true;

				const packageManager = detectPackageManager(lockfileName);
				if (!packageManager) continue;

				const newLockfile = await generateLockfile(updatedPackageJson, packageManager, existingLockfile.content);

				additionalFiles.push({
					path: lockfileName,
					content: newLockfile,
					reason: "Update lockfile to match package.json changes",
				});

				break;
			} catch (error) {}
		}

		if (!lockfileDetected) {
			return {
				content: formatted,
				additionalFiles,
				warnings: [...warnings, "No lockfile found - you may need to run your package manager after merging"],
			};
		}

		return {
			content: formatted,
			additionalFiles,
			...(warnings.length > 0 && { warnings }),
		};
	}

	/**
	 * Extract plugin names from semantic-release JS config using regex.
	 * Matches "@semantic-release/..." package names in the config.
	 */
	private extractPlugins(content: string): string[] {
		const plugins: string[] = [];

		const pluginMatches = content.matchAll(/"(@semantic-release\/[\w-]+)"/g);
		for (const match of pluginMatches) {
			if (!plugins.includes(match[1])) {
				plugins.push(match[1]);
			}
		}

		return plugins;
	}
}
