import { spawn } from 'node:child_process';

/**
 * Format content using prettier
 */
export async function formatWithPrettier(content: string, filename: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn('npx', ['prettier', '--stdin-filepath', filename], {
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', data => {
			stdout += data.toString();
		});

		child.stderr.on('data', data => {
			stderr += data.toString();
		});

		child.on('close', code => {
			if (code === 0) {
				resolve(stdout);
			} else {
				// If prettier fails, return original content
				console.warn(`Warning: Could not format ${filename} with prettier, using original formatting`);
				console.warn(`stderr: ${stderr}`);
				resolve(content);
			}
		});

		child.on('error', err => {
			console.warn(`Warning: Could not run prettier formatter: ${err.message}`);
			resolve(content);
		});

		// Write content to stdin
		child.stdin.write(content);
		child.stdin.end();
	});
}
