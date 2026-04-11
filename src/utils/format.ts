import { spawn } from 'node:child_process';

/**
 * Format content using biome
 */
export async function formatWithBiome(content: string, filename: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn('npx', ['biome', 'format', '--stdin-file-path=' + filename], {
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
				// If biome fails, return original content
				console.warn(`Warning: Could not format ${filename} with biome, using original formatting`);
				console.warn(`stderr: ${stderr}`);
				resolve(content);
			}
		});

		child.on('error', err => {
			console.warn(`Warning: Could not run biome formatter: ${err.message}`);
			resolve(content);
		});

		// Write content to stdin
		child.stdin.write(content);
		child.stdin.end();
	});
}
