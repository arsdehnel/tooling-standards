import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import type { Argv } from 'yargs';
import { fetchFile } from '../github/fetch.js';
import { createBranch, createPullRequest, deleteBranch, findPRForBranch, updateFile } from '../github/push.js';
import type { AdditionalFile } from '../handlers/base-handler.js';
import { getHandler } from '../handlers/registry.js';
import { generateDiff } from '../utils/diff.js';
import { readTemplate } from '../utils/file-ops.js';
import { compareJsonByProperty, formatJsonPropertyChange } from '../utils/json-diff.js';
import { isJsonFile, normalizeJson } from '../utils/json-normalize.js';

interface PushArgs {
	file: string;
	owner: string;
	repo: string;
	branch?: string;
}

export const command = 'push <file>';
export const desc = 'Push a template file to a GitHub repository via PR';

export const builder = (yargs: Argv): Argv<PushArgs> => {
	return yargs
		.positional('file', {
			describe: 'Template file to push (relative to templates directory)',
			type: 'string',
			demandOption: true,
		})
		.option('owner', {
			alias: 'o',
			describe: 'GitHub repository owner/organization',
			type: 'string',
			demandOption: true,
		})
		.option('repo', {
			alias: 'r',
			describe: 'GitHub repository name',
			type: 'string',
			demandOption: true,
		})
		.option('branch', {
			alias: 'b',
			describe: 'Custom branch name (default: arsd-tooling-sync/<filename>)',
			type: 'string',
		}) as Argv<PushArgs>;
};

export const handler = async (argv: PushArgs): Promise<void> => {
	const { file, owner, repo } = argv;

	console.log(chalk.cyan(`\n📤 Pushing ${chalk.bold(file)} to ${chalk.bold(`${owner}/${repo}`)}\n`));

	// Read the template file
	const templateContent = await readTemplate(file);
	if (!templateContent) {
		throw new Error(`Template file not found: ${file}`);
	}

	// Check if there's a custom handler for this file
	const handler = getHandler(file);
	const branchName = argv.branch || `arsd-tooling-sync/${file.replace(/\//g, '-')}`;

	let processedContent = templateContent;
	let additionalFiles: AdditionalFile[] = [];
	let warnings: string[] = [];

	if (handler) {
		console.log(chalk.dim(`⚙️  Running custom handler for ${file}...\n`));
		const result = await handler.beforePush(templateContent, {
			filename: file,
			owner,
			repo,
			branchName,
		});
		processedContent = result.content;
		additionalFiles = result.additionalFiles || [];
		warnings = result.warnings || [];

		// Show warnings if any
		if (warnings.length > 0) {
			for (const warning of warnings) {
				console.log(chalk.yellow(`⚠️  ${warning}`));
			}
			console.log('');
		}
	} else {
		// No handler - normalize if JSON
		processedContent = isJsonFile(file) ? normalizeJson(templateContent) : templateContent;
	}

	// Collect all files to push (main file + additional files)
	interface FileToPush {
		path: string;
		content: string;
		remoteContent: string | null;
		reason?: string;
	}

	const filesToPush: FileToPush[] = [];

	// Try to fetch the current file from the repo
	let remoteContent: string | null = null;
	try {
		const fetched = await fetchFile(owner, repo, file);
		remoteContent = fetched.content;
		console.log(chalk.green(`✓ Found existing ${file} in ${owner}/${repo}\n`));
	} catch (error) {
		if (error instanceof Error && error.message.includes('File not found')) {
			console.log(chalk.yellow(`⚠ File ${file} does not exist in ${owner}/${repo} (will create new file)\n`));
		} else {
			throw error;
		}
	}

	filesToPush.push({
		path: file,
		content: processedContent,
		remoteContent,
	});

	// Fetch remote content for additional files
	for (const additionalFile of additionalFiles) {
		let additionalRemoteContent: string | null = null;
		try {
			const fetched = await fetchFile(owner, repo, additionalFile.path);
			additionalRemoteContent = fetched.content;
		} catch (error) {
			// File doesn't exist - will be created
		}

		filesToPush.push({
			path: additionalFile.path,
			content: additionalFile.content,
			remoteContent: additionalRemoteContent,
			reason: additionalFile.reason,
		});
	}

	// Show diff for each file
	let hasChanges = false;

	for (const fileToPush of filesToPush) {
		if (fileToPush.remoteContent) {
			const normalizedRemote = isJsonFile(fileToPush.path)
				? normalizeJson(fileToPush.remoteContent)
				: fileToPush.remoteContent;
			const normalizedNew = isJsonFile(fileToPush.path) ? normalizeJson(fileToPush.content) : fileToPush.content;

			// Check if there are any changes
			if (normalizedNew === normalizedRemote) {
				continue;
			}

			hasChanges = true;

			console.log(
				chalk.bold(
					`📋 Changes to ${chalk.cyan(fileToPush.path)}${fileToPush.reason ? chalk.dim(` (${fileToPush.reason})`) : ''}:\n`,
				),
			);

			if (isJsonFile(fileToPush.path)) {
				// Show property-by-property diff for JSON
				const changes = compareJsonByProperty(normalizedRemote, normalizedNew);
				if (changes && changes.length > 0) {
					for (const change of changes) {
						console.log(formatJsonPropertyChange(change, 'push'));
						console.log('');
					}
				}
			} else {
				// Show traditional diff for non-JSON
				const diff = generateDiff(normalizedRemote, normalizedNew, fileToPush.path);
				console.log(diff);
				console.log('');
			}
		} else {
			hasChanges = true;

			// New file - show content preview
			console.log(
				chalk.bold(
					`📄 New file ${chalk.cyan(fileToPush.path)}${fileToPush.reason ? chalk.dim(` (${fileToPush.reason})`) : ''}:\n`,
				),
			);
			const preview = fileToPush.content.split('\n').slice(0, 20).join('\n');
			console.log(chalk.dim(preview));
			if (fileToPush.content.split('\n').length > 20) {
				console.log(chalk.dim(`\n... (${fileToPush.content.split('\n').length - 20} more lines)`));
			}
			console.log('');
		}
	}

	if (!hasChanges) {
		console.log(chalk.green('✓ No changes detected - files are identical\n'));
		return;
	}

	// Ask for confirmation
	const fileList = filesToPush.map(f => f.path).join(', ');
	const shouldPush = await confirm({
		message: `Push changes to ${fileList} in ${owner}/${repo}?`,
		default: true,
	});

	if (!shouldPush) {
		console.log(chalk.yellow('\n⏭ Push cancelled\n'));
		return;
	}

	// Check if a PR already exists for this branch
	console.log(chalk.cyan(`\n🔍 Checking for existing PR...`));
	const existingPR = await findPRForBranch(owner, repo, branchName);

	let shouldCreatePR = true;
	let existingPRUrl: string | undefined;

	if (existingPR) {
		if (existingPR.state === 'open') {
			console.log(chalk.yellow(`⚠ Found open PR #${existingPR.number}, will update it\n`));
			shouldCreatePR = false;
			existingPRUrl = existingPR.url;
		} else if (existingPR.merged) {
			console.log(chalk.blue(`ℹ️  Found merged PR #${existingPR.number}, will create a new PR\n`));
			console.log(chalk.cyan(`🗑️  Deleting old branch ${chalk.bold(branchName)}...`));
			await deleteBranch(owner, repo, branchName);
			console.log(chalk.green(`✓ Old branch deleted\n`));
		} else {
			console.log(chalk.blue(`ℹ️  Found closed PR #${existingPR.number}, will create a new PR\n`));
			console.log(chalk.cyan(`🗑️  Deleting old branch ${chalk.bold(branchName)}...`));
			await deleteBranch(owner, repo, branchName);
			console.log(chalk.green(`✓ Old branch deleted\n`));
		}
	} else {
		console.log(chalk.green(`✓ No existing PR found\n`));
	}

	// Create or update branch
	if (shouldCreatePR || !existingPR || existingPR.state !== 'open') {
		console.log(chalk.cyan(`🌿 Creating branch ${chalk.bold(branchName)}...`));

		try {
			await createBranch(owner, repo, branchName);
			console.log(chalk.green(`✓ Branch created\n`));
		} catch (error) {
			if (error instanceof Error && error.message.includes('already exists')) {
				// This shouldn't happen since we checked for PR and deleted if needed
				// But just in case, delete and recreate
				console.log(chalk.yellow(`⚠ Branch exists without PR, recreating...\n`));
				await deleteBranch(owner, repo, branchName);
				await createBranch(owner, repo, branchName);
				console.log(chalk.green(`✓ Branch created\n`));
			} else {
				throw error;
			}
		}
	}

	// Update all files on branch
	for (const fileToPush of filesToPush) {
		console.log(chalk.cyan(`📝 Updating ${fileToPush.path}...`));
		const commitMessage = fileToPush.remoteContent
			? `chore: update ${fileToPush.path} from tooling-standards`
			: `chore: add ${fileToPush.path} from tooling-standards`;

		await updateFile(owner, repo, fileToPush.path, fileToPush.content, branchName, commitMessage);
		console.log(chalk.green(`✓ ${fileToPush.path} updated\n`));
	}

	// Create PR if needed
	if (shouldCreatePR) {
		console.log(chalk.cyan(`🔀 Creating pull request...`));
		const prTitle = filesToPush.length === 1 ? `Update ${file}` : `Update ${file} and related files`;

		let prBody = `This PR updates configuration files from the tooling-standards repository.\n\n`;
		prBody += `**Files changed:**\n`;
		for (const fileToPush of filesToPush) {
			prBody += `- \`${fileToPush.path}\`${fileToPush.reason ? ` - ${fileToPush.reason}` : ''}\n`;
		}
		prBody += `\n🤖 Generated by [tooling-standards](https://github.com/arsdehnel/tooling-standards)`;

		const pr = await createPullRequest(owner, repo, branchName, prTitle, prBody);
		console.log(chalk.green(`✓ Pull request created!\n`));

		console.log(chalk.bold.green(`\n✨ Success!\n`));
		console.log(`${chalk.bold('PR:')} ${pr.url}`);
		console.log(`${chalk.bold('Branch:')} ${branchName}`);
		console.log(`${chalk.bold('Title:')} ${pr.title}\n`);
	} else {
		console.log(chalk.bold.green(`\n✨ Success!\n`));
		console.log(`${chalk.bold('PR:')} ${existingPRUrl}`);
		console.log(`${chalk.bold('Branch:')} ${branchName}`);
		console.log(chalk.dim('(Existing PR updated with new commits)\n'));
	}
};
