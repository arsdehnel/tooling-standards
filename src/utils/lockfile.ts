import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type PackageManager = 'pnpm' | 'npm' | 'yarn';

/**
 * Detect package manager from lockfile name
 */
export function detectPackageManager(lockfileName: string): PackageManager | null {
	if (lockfileName === 'pnpm-lock.yaml') return 'pnpm';
	if (lockfileName === 'package-lock.json') return 'npm';
	if (lockfileName === 'yarn.lock') return 'yarn';
	return null;
}

/**
 * Generate a lockfile for the given package.json content
 */
export async function generateLockfile(
	packageJsonContent: string,
	packageManager: PackageManager,
	existingLockfile?: string,
): Promise<string> {
	// Create temporary directory
	const tempDir = await mkdtemp(join(tmpdir(), 'tooling-standards-'));

	try {
		// Write package.json to temp dir
		const packageJsonPath = join(tempDir, 'package.json');
		await writeFile(packageJsonPath, packageJsonContent, 'utf-8');

		// Write existing lockfile if provided (allows incremental update)
		const lockfileName = getLockfileName(packageManager);
		if (existingLockfile) {
			const lockfilePath = join(tempDir, lockfileName);
			await writeFile(lockfilePath, existingLockfile, 'utf-8');
		}

		// Run package manager to update lockfile
		await runPackageManagerInstall(packageManager, tempDir);

		// Read updated lockfile
		const lockfilePath = join(tempDir, lockfileName);
		const lockfileContent = await readFile(lockfilePath, 'utf-8');

		return lockfileContent;
	} finally {
		// Clean up temp directory
		await rm(tempDir, { recursive: true, force: true });
	}
}

/**
 * Get lockfile name for package manager
 */
function getLockfileName(packageManager: PackageManager): string {
	switch (packageManager) {
		case 'pnpm':
			return 'pnpm-lock.yaml';
		case 'npm':
			return 'package-lock.json';
		case 'yarn':
			return 'yarn.lock';
	}
}

/**
 * Run package manager install command
 */
function runPackageManagerInstall(packageManager: PackageManager, cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const args = packageManager === 'yarn' ? ['install', '--frozen-lockfile'] : ['install', '--lockfile-only'];

		const child = spawn(packageManager, args, {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		let stderr = '';
		child.stderr.on('data', data => {
			stderr += data.toString();
		});

		child.on('close', code => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`${packageManager} install failed: ${stderr}`));
			}
		});

		child.on('error', err => {
			reject(new Error(`Failed to run ${packageManager}: ${err.message}`));
		});
	});
}
