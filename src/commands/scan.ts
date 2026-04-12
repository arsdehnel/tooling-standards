import chalk from 'chalk';
import type { Argv } from 'yargs';
import { fetchFile } from '../github/fetch.js';
import { parseRepository, readConfig } from '../utils/config.js';
import { generateDiff, parseHunks } from '../utils/diff.js';
import { readTemplate } from '../utils/file-ops.js';
import { compareJsonByProperty } from '../utils/json-diff.js';
import { isJsonFile, normalizeJson } from '../utils/json-normalize.js';

interface ScanArgs {
	file: string;
	repo?: string[];
}

interface ScanResult {
	owner: string;
	repo: string;
	status: 'compliant' | 'differs' | 'missing' | 'error';
	differenceCount: number;
	error?: string;
}

export const command = 'scan <file>';
export const desc = 'Scan repositories for compliance with a template file';

export const builder = (yargs: Argv): Argv<ScanArgs> => {
	return yargs
		.positional('file', {
			describe: 'Template file to scan for (e.g., biome.json)',
			type: 'string',
			demandOption: true,
		})
		.option('repo', {
			alias: 'r',
			describe: 'Scan specific repository(ies) instead of all configured',
			type: 'array',
			string: true,
		}) as Argv<ScanArgs>;
};

export const handler = async (argv: ScanArgs): Promise<void> => {
	const { file } = argv;

	// Read template file
	const templateContent = await readTemplate(file);
	if (!templateContent) {
		console.error(chalk.red(`\n❌ Template file not found: ${file}\n`));
		process.exit(1);
	}

	// Get list of repositories
	let repositories: string[];
	if (argv.repo && argv.repo.length > 0) {
		repositories = argv.repo;
	} else {
		try {
			const config = await readConfig();
			repositories = config.repositories;
		} catch (error) {
			console.error(chalk.red(`\n❌ ${error instanceof Error ? error.message : String(error)}\n`));
			process.exit(1);
		}
	}

	if (repositories.length === 0) {
		console.error(chalk.red('\n❌ No repositories to scan\n'));
		process.exit(1);
	}

	console.log(
		chalk.cyan(
			`\n🔍 Scanning ${repositories.length} ${repositories.length === 1 ? 'repository' : 'repositories'} for ${chalk.bold(file)}...\n`,
		),
	);

	// Scan each repository
	const results: ScanResult[] = [];
	for (const repoString of repositories) {
		try {
			const { owner, repo } = parseRepository(repoString);
			const result = await scanRepository(owner, repo, file, templateContent);
			results.push(result);
		} catch (error) {
			const parts = repoString.split('/');
			results.push({
				owner: parts[0] || 'unknown',
				repo: parts[1] || 'unknown',
				status: 'error',
				differenceCount: 0,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// Display results table
	displayResults(results);

	// Display summary
	displaySummary(results);
};

async function scanRepository(owner: string, repo: string, filename: string, templateContent: string): Promise<ScanResult> {
	try {
		// Fetch file from repository
		const fetched = await fetchFile(owner, repo, filename);
		const remoteContent = fetched.content;

		// Normalize and compare
		const normalizedTemplate = isJsonFile(filename) ? normalizeJson(templateContent) : templateContent;
		const normalizedRemote = isJsonFile(filename) ? normalizeJson(remoteContent) : remoteContent;

		// Check if identical
		if (normalizedTemplate === normalizedRemote) {
			return {
				owner,
				repo,
				status: 'compliant',
				differenceCount: 0,
			};
		}

		// Count differences
		let differenceCount = 0;
		if (isJsonFile(filename)) {
			const changes = compareJsonByProperty(normalizedRemote, normalizedTemplate);
			differenceCount = changes?.length || 0;
		} else {
			const diff = generateDiff(normalizedRemote, normalizedTemplate, filename);
			const hunks = parseHunks(diff);
			differenceCount = hunks.length;
		}

		return {
			owner,
			repo,
			status: 'differs',
			differenceCount,
		};
	} catch (error) {
		if (error instanceof Error && error.message.includes('File not found')) {
			return {
				owner,
				repo,
				status: 'missing',
				differenceCount: 0,
			};
		}

		throw error;
	}
}

function displayResults(results: ScanResult[]): void {
	const maxRepoLength = Math.max(...results.map(r => `${r.owner}/${r.repo}`.length), 'Repository'.length);

	// Header
	console.log(chalk.bold('Repository'.padEnd(maxRepoLength + 2)) + chalk.bold('Status'.padEnd(15)) + chalk.bold('Differences'));
	console.log('─'.repeat(maxRepoLength + 2 + 15 + 20));

	// Rows
	for (const result of results) {
		const repoName = `${result.owner}/${result.repo}`.padEnd(maxRepoLength + 2);
		let statusIcon: string;
		let statusText: string;
		let diffText: string;

		switch (result.status) {
			case 'compliant':
				statusIcon = chalk.green('✓');
				statusText = chalk.green('Compliant'.padEnd(14));
				diffText = chalk.dim('None');
				break;
			case 'differs':
				statusIcon = chalk.yellow('~');
				statusText = chalk.yellow('Differs'.padEnd(14));
				diffText = chalk.yellow(`${result.differenceCount} ${result.differenceCount === 1 ? 'change' : 'changes'}`);
				break;
			case 'missing':
				statusIcon = chalk.red('✗');
				statusText = chalk.red('Missing'.padEnd(14));
				diffText = chalk.dim('File not found');
				break;
			case 'error':
				statusIcon = chalk.red('!');
				statusText = chalk.red('Error'.padEnd(14));
				diffText = chalk.red(result.error || 'Unknown error');
				break;
		}

		console.log(`${statusIcon} ${repoName}${statusText}${diffText}`);
	}

	console.log('');
}

function displaySummary(results: ScanResult[]): void {
	const compliant = results.filter(r => r.status === 'compliant').length;
	const differs = results.filter(r => r.status === 'differs').length;
	const missing = results.filter(r => r.status === 'missing').length;
	const errors = results.filter(r => r.status === 'error').length;

	const parts: string[] = [];
	if (compliant > 0) parts.push(chalk.green(`${compliant} compliant`));
	if (differs > 0) parts.push(chalk.yellow(`${differs} need updates`));
	if (missing > 0) parts.push(chalk.red(`${missing} missing`));
	if (errors > 0) parts.push(chalk.red(`${errors} errors`));

	console.log(chalk.bold('Summary: ') + parts.join(', '));
	console.log('');
}
