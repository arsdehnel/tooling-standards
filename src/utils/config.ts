import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';

export interface Config {
	repositories: string[];
}

export interface ParsedRepo {
	owner: string;
	repo: string;
}

const CONFIG_FILE = 'tooling-standards.yaml';

/**
 * Read and parse the config file
 */
export async function readConfig(): Promise<Config> {
	try {
		const content = await readFile(CONFIG_FILE, 'utf-8');
		const config = yaml.load(content) as Config;

		if (!config.repositories || !Array.isArray(config.repositories)) {
			throw new Error('Config file must have a "repositories" array');
		}

		return config;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			throw new Error(
				`Config file not found: ${CONFIG_FILE}\n\nCreate a ${CONFIG_FILE} file with:\n\nrepositories:\n  - owner/repo\n  - owner2/repo2`,
			);
		}
		throw error;
	}
}

/**
 * Parse "owner/repo" format into separate fields
 */
export function parseRepository(repoString: string): ParsedRepo {
	const parts = repoString.split('/');
	if (parts.length !== 2) {
		throw new Error(`Invalid repository format: ${repoString}. Expected format: owner/repo`);
	}

	return {
		owner: parts[0],
		repo: parts[1],
	};
}
