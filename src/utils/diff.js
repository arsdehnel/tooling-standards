import chalk from 'chalk';
import { applyPatch, createTwoFilesPatch, parsePatch } from 'diff';

export function generateDiff(oldContent, newContent, filename) {
	const patch = createTwoFilesPatch(
		`a/${filename}`,
		`b/${filename}`,
		oldContent,
		newContent,
		'Current template',
		'Fetched from repo',
	);

	return patch;
}

export function formatDiff(diff) {
	const lines = diff.split('\n');
	return lines
		.map(line => {
			if (line.startsWith('+') && !line.startsWith('+++')) {
				return chalk.green(line);
			} else if (line.startsWith('-') && !line.startsWith('---')) {
				return chalk.red(line);
			} else if (line.startsWith('@@')) {
				return chalk.cyan(line);
			} else if (line.startsWith('+++') || line.startsWith('---')) {
				return chalk.bold(line);
			}
			return chalk.dim(line);
		})
		.join('\n');
}

export function parseHunks(patchText) {
	const parsed = parsePatch(patchText);
	if (!parsed || parsed.length === 0) {
		return [];
	}

	const file = parsed[0];
	return file.hunks.map((hunk, index) => ({
		index,
		header: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
		lines: hunk.lines,
		oldStart: hunk.oldStart,
		oldLines: hunk.oldLines,
		newStart: hunk.newStart,
		newLines: hunk.newLines,
	}));
}

export function formatHunk(hunk) {
	const lines = [chalk.cyan(hunk.header)];

	for (const line of hunk.lines) {
		if (line.startsWith('+')) {
			lines.push(chalk.green(line));
		} else if (line.startsWith('-')) {
			lines.push(chalk.red(line));
		} else {
			lines.push(chalk.dim(line));
		}
	}

	return lines.join('\n');
}

export function applySelectedHunks(oldContent, patchText, selectedIndexes) {
	const parsed = parsePatch(patchText);
	if (!parsed || parsed.length === 0) {
		return oldContent;
	}

	const file = parsed[0];

	// Filter to only selected hunks
	const filteredFile = {
		...file,
		hunks: file.hunks.filter((_, index) => selectedIndexes.includes(index)),
	};

	// If no hunks selected, return original
	if (filteredFile.hunks.length === 0) {
		return oldContent;
	}

	// Reconstruct patch with only selected hunks
	const selectedPatch = `--- ${file.oldFileName}
+++ ${file.newFileName}
${filteredFile.hunks
	.map(hunk => `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n${hunk.lines.join('\n')}`)
	.join('\n')}`;

	const result = applyPatch(oldContent, selectedPatch);

	if (result === false) {
		throw new Error('Failed to apply selected changes');
	}

	return result;
}
