import chalk from 'chalk';

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

interface PropertyChangeAdded {
	type: 'added';
	key: string;
	newValue: JsonValue;
}

interface PropertyChangeRemoved {
	type: 'removed';
	key: string;
	oldValue: JsonValue;
}

interface PropertyChangeModified {
	type: 'modified';
	key: string;
	oldValue: JsonValue;
	newValue: JsonValue;
}

export type PropertyChange = PropertyChangeAdded | PropertyChangeRemoved | PropertyChangeModified;

export function compareJsonByProperty(oldContent: string, newContent: string): PropertyChange[] | null {
	let oldJson: JsonValue;
	let newJson: JsonValue;

	try {
		oldJson = JSON.parse(oldContent);
		newJson = JSON.parse(newContent);
	} catch (_error) {
		return null; // Not valid JSON
	}

	const changes: PropertyChange[] = [];
	const oldKeys = new Set(Object.keys(oldJson as Record<string, JsonValue>));
	const newKeys = new Set(Object.keys(newJson as Record<string, JsonValue>));
	const allKeys = new Set([...oldKeys, ...newKeys]);

	for (const key of allKeys) {
		const inOld = oldKeys.has(key);
		const inNew = newKeys.has(key);

		if (!inOld && inNew) {
			// Added property
			changes.push({
				type: 'added',
				key,
				newValue: newJson[key],
			});
		} else if (inOld && !inNew) {
			// Removed property
			changes.push({
				type: 'removed',
				key,
				oldValue: oldJson[key],
			});
		} else if (JSON.stringify(oldJson[key]) !== JSON.stringify(newJson[key])) {
			// Modified property
			changes.push({
				type: 'modified',
				key,
				oldValue: oldJson[key],
				newValue: newJson[key],
			});
		}
		// else: unchanged, skip
	}

	return changes;
}

export function formatJsonPropertyChange(change: PropertyChange): string {
	const lines: string[] = [];

	if (change.type === 'added') {
		lines.push(chalk.green(`+ Add property: ${chalk.bold(change.key)}`));
		lines.push(chalk.dim(''));
		lines.push(chalk.green('+ Remote:'));
		lines.push(chalk.green(JSON.stringify({ [change.key]: change.newValue }, null, 2)));
	} else if (change.type === 'removed') {
		lines.push(chalk.red(`- Remove property: ${chalk.bold(change.key)}`));
		lines.push(chalk.dim(''));
		lines.push(chalk.red('- Local:'));
		lines.push(chalk.red(JSON.stringify({ [change.key]: change.oldValue }, null, 2)));
	} else if (change.type === 'modified') {
		lines.push(chalk.yellow(`~ Modify property: ${chalk.bold(change.key)}`));
		lines.push(chalk.dim(''));
		lines.push(chalk.red('- Local:'));
		lines.push(chalk.red(JSON.stringify({ [change.key]: change.oldValue }, null, 2)));
		lines.push(chalk.dim(''));
		lines.push(chalk.green('+ Remote:'));
		lines.push(chalk.green(JSON.stringify({ [change.key]: change.newValue }, null, 2)));
	}

	return lines.join('\n');
}

export function applyJsonPropertyChanges(oldContent: string, selectedChanges: PropertyChange[]): string {
	const oldJson = JSON.parse(oldContent) as Record<string, JsonValue>;
	const result: Record<string, JsonValue> = { ...oldJson };

	for (const change of selectedChanges) {
		if (change.type === 'added' || change.type === 'modified') {
			result[change.key] = change.newValue;
		} else if (change.type === 'removed') {
			delete result[change.key];
		}
	}

	return JSON.stringify(result, null, 2);
}
