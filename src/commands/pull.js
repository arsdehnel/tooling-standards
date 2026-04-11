import { confirm, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { fetchFile } from '../github/fetch.js';
import { applySelectedHunks, formatDiff, formatHunk, generateDiff, parseHunks } from '../utils/diff.js';
import { readTemplate, saveTemplate, templateExists } from '../utils/file-ops.js';
import { applyJsonPropertyChanges, compareJsonByProperty, formatJsonPropertyChange } from '../utils/json-diff.js';
import { isJsonFile, normalizeJson } from '../utils/json-normalize.js';

export const command = 'pull <file>';
export const describe = 'Pull a config file from a GitHub repository';

export const builder = yargs => {
	return yargs
		.positional('file', {
			describe: 'Config file to pull (e.g., biome.json, tsconfig.json)',
			type: 'string',
		})
		.option('owner', {
			alias: 'o',
			describe: 'GitHub repository owner',
			type: 'string',
			default: 'arsdehnel',
		})
		.option('repo', {
			alias: 'r',
			describe: 'GitHub repository name',
			type: 'string',
			demandOption: true,
		})
		.option('branch', {
			alias: 'b',
			describe: 'Branch or ref to pull from',
			type: 'string',
			default: 'main',
		})
		.option('save', {
			alias: 's',
			describe: 'Automatically save without prompting',
			type: 'boolean',
			default: false,
		});
};

export const handler = async argv => {
	const { file, owner, repo, branch, save } = argv;

	try {
		console.log(
			chalk.cyan(`\n📥 Fetching ${chalk.bold(file)} from ${chalk.bold(`${owner}/${repo}`)} ${chalk.dim(`(${branch})`)}`),
		);

		const fetched = await fetchFile(owner, repo, file, branch);

		console.log(chalk.green(`✓ Fetched ${chalk.bold(file)} ${chalk.dim(`(${fetched.size} bytes)`)}\n`));

		const exists = await templateExists(file);

		let contentToSave = fetched.content;

		if (exists) {
			let currentContent = await readTemplate(file);
			let newContent = fetched.content;

			// Normalize JSON files for cleaner diffs
			if (isJsonFile(file)) {
				currentContent = normalizeJson(currentContent);
				newContent = normalizeJson(newContent);
			}

			if (currentContent === newContent) {
				console.log(chalk.green('✨ No changes - template is already up to date'));
				return;
			}

			// For JSON files, use property-by-property comparison
			if (isJsonFile(file)) {
				const propertyChanges = compareJsonByProperty(currentContent, newContent);

				if (!propertyChanges || propertyChanges.length === 0) {
					console.log(chalk.green('✨ No changes - template is already up to date'));
					return;
				}

				console.log(
					chalk.yellow(`📝 Found ${propertyChanges.length} property change${propertyChanges.length > 1 ? 's' : ''}:\n`),
				);

				if (save) {
					// Auto-save: accept all changes
					for (const change of propertyChanges) {
						console.log(formatJsonPropertyChange(change));
						console.log('');
					}
					contentToSave = newContent;
				} else {
					// Interactive property-by-property approval
					const selectedChanges = [];

					for (let i = 0; i < propertyChanges.length; i++) {
						const change = propertyChanges[i];
						console.log(chalk.bold(`\n--- Property ${i + 1} of ${propertyChanges.length} ---`));
						console.log(formatJsonPropertyChange(change));
						console.log('');

						const action = await select({
							message: 'What would you like to do?',
							choices: [
								{ name: '⊗ Keep local (skip this change)', value: 'no' },
								{ name: '✓ Use remote (accept this change)', value: 'yes' },
								{ name: '⊗⊗ Keep local for all remaining', value: 'none' },
								{ name: '✓✓ Use remote for all remaining', value: 'all' },
							],
						});

						if (action === 'yes') {
							selectedChanges.push(change);
						} else if (action === 'all') {
							// Accept this one and all remaining
							for (let j = i; j < propertyChanges.length; j++) {
								selectedChanges.push(propertyChanges[j]);
							}
							break;
						} else if (action === 'none') {
							// Skip all remaining
							break;
						}
						// 'no' just continues to next change
					}

					if (selectedChanges.length === 0) {
						console.log(chalk.dim('\n⏭️  No changes accepted'));
						return;
					}

					console.log(
						chalk.green(
							`\n✓ Applying ${selectedChanges.length} of ${propertyChanges.length} change${propertyChanges.length > 1 ? 's' : ''}`,
						),
					);
					contentToSave = applyJsonPropertyChanges(currentContent, selectedChanges);
				}
			} else {
				// For non-JSON files, use traditional diff hunks
				const diff = generateDiff(currentContent, newContent, file);
				const hunks = parseHunks(diff);

				if (hunks.length === 0) {
					console.log(chalk.green('✨ No changes - template is already up to date'));
					return;
				}

				console.log(chalk.yellow(`📝 Found ${hunks.length} change${hunks.length > 1 ? 's' : ''}:\n`));

				if (save) {
					// Auto-save: accept all changes
					console.log(formatDiff(diff));
					console.log('');
					contentToSave = newContent;
				} else {
					// Interactive hunk approval
					const selectedIndexes = [];

					for (let i = 0; i < hunks.length; i++) {
						const hunk = hunks[i];
						console.log(chalk.bold(`\n--- Change ${i + 1} of ${hunks.length} ---`));
						console.log(formatHunk(hunk));
						console.log('');

						const action = await select({
							message: 'What would you like to do?',
							choices: [
								{ name: '⊗ Keep local (skip this change)', value: 'no' },
								{ name: '✓ Use remote (accept this change)', value: 'yes' },
								{ name: '⊗⊗ Keep local for all remaining', value: 'none' },
								{ name: '✓✓ Use remote for all remaining', value: 'all' },
							],
						});

						if (action === 'yes') {
							selectedIndexes.push(i);
						} else if (action === 'all') {
							// Accept this one and all remaining
							for (let j = i; j < hunks.length; j++) {
								selectedIndexes.push(j);
							}
							break;
						} else if (action === 'none') {
							// Skip all remaining
							break;
						}
						// 'no' just continues to next hunk
					}

					if (selectedIndexes.length === 0) {
						console.log(chalk.dim('\n⏭️  No changes accepted'));
						return;
					}

					console.log(
						chalk.green(`\n✓ Applying ${selectedIndexes.length} of ${hunks.length} change${hunks.length > 1 ? 's' : ''}`),
					);
					contentToSave = applySelectedHunks(currentContent, diff, selectedIndexes);
				}
			}
		} else {
			console.log(chalk.blue('ℹ️  Template does not exist yet.\n'));

			// Normalize JSON files
			if (isJsonFile(file)) {
				contentToSave = normalizeJson(fetched.content);
			}

			if (!save) {
				const shouldCreate = await confirm({
					message: 'Create this template?',
					default: true,
				});

				if (!shouldCreate) {
					console.log(chalk.dim('⏭️  Skipped creation'));
					return;
				}
			}
		}

		const savedPath = await saveTemplate(file, contentToSave);
		console.log(chalk.green(`💾 Saved to ${chalk.bold(savedPath)}`));
	} catch (error) {
		if (error.message.includes('Repository not found')) {
			console.error(chalk.red(`\n❌ Repository ${chalk.bold(`${owner}/${repo}`)} not found`));
			console.log(chalk.dim('\n💡 Check that:'));
			console.log(chalk.dim('   - The repository name is spelled correctly'));
			console.log(chalk.dim('   - You have access to this repository'));
			console.log(chalk.dim('   - Your GitHub token has the correct permissions'));
			process.exit(1);
		}

		if (error.message.includes('File not found')) {
			console.error(chalk.red(`\n❌ ${chalk.bold(file)} does not exist in ${chalk.bold(`${owner}/${repo}`)}`));
			console.log(chalk.dim('\n💡 This file is not in the target repository.'));
			console.log(chalk.dim('   To add your standard config to this repo, you can use the push command (coming soon).'));
			process.exit(0);
		}

		console.error(chalk.red(`\n⚠️  Error: ${error.message}`));
		process.exit(1);
	}
};
