#!/usr/bin/env tsx
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import yargs, { type Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Filter out standalone '--' that pnpm/npm might add
const args = hideBin(process.argv).filter(arg => arg !== '--');

const _argv = yargs(args)
	.scriptName('tooling')
	.usage('$0 <command> [options]')
	.commandDir(join(__dirname, 'commands'), { extensions: ['ts', 'js'] })
	.demandCommand(1, chalk.yellow('You must provide a command'))
	.strict()
	.recommendCommands()
	.fail((msg: string | undefined, err: Error | undefined, yargs: Argv) => {
		if (err) {
			console.error(chalk.red(`\n⚠️  ${err.message}`));
			process.exit(1);
		}
		if (msg) {
			console.error(chalk.yellow(`\n⚠️  ${msg}\n`));
			yargs.showHelp();
			process.exit(1);
		}
	})
	.help()
	.alias('h', 'help')
	.version()
	.alias('v', 'version')
	.parse();
