import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BiomeHandler } from '../biome-handler.js';

// Mock dependencies
vi.mock('../../github/fetch.js');
vi.mock('../../utils/format.js');
vi.mock('../../utils/format-prettier.js');
vi.mock('../../utils/lockfile.js');

describe('BiomeHandler', () => {
	let handler: BiomeHandler;

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new BiomeHandler();
	});

	it('should return formatted content when no $schema is present', async () => {
		const { formatWithBiome } = await import('../../utils/format.js');
		vi.mocked(formatWithBiome).mockResolvedValue('{"formatted": true}');

		const result = await handler.beforePush('{"test": true}', {
			filename: 'biome.json',
			owner: 'owner',
			repo: 'repo',
			branchName: 'branch',
		});

		expect(result).toEqual({
			content: '{"formatted": true}',
		});
	});

	it('should return formatted content when $schema has invalid version format', async () => {
		const { formatWithBiome } = await import('../../utils/format.js');
		vi.mocked(formatWithBiome).mockResolvedValue('{"$schema": "https://biomejs.dev/schema.json"}');

		const result = await handler.beforePush('{"$schema": "https://biomejs.dev/schema.json"}', {
			filename: 'biome.json',
			owner: 'owner',
			repo: 'repo',
			branchName: 'branch',
		});

		expect(result).toEqual({
			content: '{"$schema": "https://biomejs.dev/schema.json"}',
		});
	});

	it('should return warning when package.json cannot be fetched', async () => {
		const { formatWithBiome } = await import('../../utils/format.js');
		const { fetchFile } = await import('../../github/fetch.js');

		vi.mocked(formatWithBiome).mockResolvedValue('{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}');
		vi.mocked(fetchFile).mockRejectedValue(new Error('Not found'));

		const result = await handler.beforePush('{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}', {
			filename: 'biome.json',
			owner: 'owner',
			repo: 'repo',
			branchName: 'branch',
		});

		expect(result).toEqual({
			content: '{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}',
			warnings: ['Could not fetch package.json - biome version will not be updated'],
		});
	});

	it('should not update package.json when biome version already matches', async () => {
		const { formatWithBiome } = await import('../../utils/format.js');
		const { fetchFile } = await import('../../github/fetch.js');

		vi.mocked(formatWithBiome).mockResolvedValue('{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}');
		vi.mocked(fetchFile).mockResolvedValue({
			content: JSON.stringify({
				devDependencies: {
					'@biomejs/biome': '^2.4.11',
				},
			}),
			sha: 'sha',
			path: 'package.json',
			size: 100,
		});

		const result = await handler.beforePush('{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}', {
			filename: 'biome.json',
			owner: 'owner',
			repo: 'repo',
			branchName: 'branch',
		});

		expect(result).toEqual({
			content: '{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}',
		});
	});

	it('should update biome version in devDependencies when outdated', async () => {
		const { formatWithBiome } = await import('../../utils/format.js');
		const { fetchFile } = await import('../../github/fetch.js');
		const { formatWithPrettier } = await import('../../utils/format-prettier.js');

		vi.mocked(formatWithBiome).mockResolvedValue('{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}');
		vi.mocked(fetchFile).mockResolvedValue({
			content: JSON.stringify({
				devDependencies: {
					'@biomejs/biome': '^2.3.0',
				},
			}),
			sha: 'sha',
			path: 'package.json',
			size: 100,
		});
		vi.mocked(formatWithPrettier).mockImplementation(content => Promise.resolve(content));

		const result = await handler.beforePush('{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}', {
			filename: 'biome.json',
			owner: 'owner',
			repo: 'repo',
			branchName: 'branch',
		});

		expect(result.content).toBe('{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}');
		expect(result.additionalFiles).toHaveLength(1);
		expect(result.additionalFiles![0].path).toBe('package.json');
		expect(result.additionalFiles![0].reason).toBe('Update @biomejs/biome to ^2.4.11 to match schema version');

		const updatedPackageJson = JSON.parse(result.additionalFiles![0].content);
		expect(updatedPackageJson.devDependencies['@biomejs/biome']).toBe('^2.4.11');
	});

	it('should update biome version in dependencies when outdated', async () => {
		const { formatWithBiome } = await import('../../utils/format.js');
		const { fetchFile } = await import('../../github/fetch.js');
		const { formatWithPrettier } = await import('../../utils/format-prettier.js');

		vi.mocked(formatWithBiome).mockResolvedValue('{"$schema": "https://biomejs.dev/schemas/3.0.0/schema.json"}');
		vi.mocked(fetchFile).mockResolvedValue({
			content: JSON.stringify({
				dependencies: {
					'@biomejs/biome': '^2.4.11',
				},
			}),
			sha: 'sha',
			path: 'package.json',
			size: 100,
		});
		vi.mocked(formatWithPrettier).mockImplementation(content => Promise.resolve(content));

		const result = await handler.beforePush('{"$schema": "https://biomejs.dev/schemas/3.0.0/schema.json"}', {
			filename: 'biome.json',
			owner: 'owner',
			repo: 'repo',
			branchName: 'branch',
		});

		expect(result.additionalFiles).toHaveLength(1);
		const updatedPackageJson = JSON.parse(result.additionalFiles![0].content);
		expect(updatedPackageJson.dependencies['@biomejs/biome']).toBe('^3.0.0');
	});

	it('should add biome to devDependencies when not present', async () => {
		const { formatWithBiome } = await import('../../utils/format.js');
		const { fetchFile } = await import('../../github/fetch.js');
		const { formatWithPrettier } = await import('../../utils/format-prettier.js');

		vi.mocked(formatWithBiome).mockResolvedValue('{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}');
		vi.mocked(fetchFile).mockResolvedValue({
			content: JSON.stringify({
				dependencies: {},
			}),
			sha: 'sha',
			path: 'package.json',
			size: 100,
		});
		vi.mocked(formatWithPrettier).mockImplementation(content => Promise.resolve(content));

		const result = await handler.beforePush('{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}', {
			filename: 'biome.json',
			owner: 'owner',
			repo: 'repo',
			branchName: 'branch',
		});

		expect(result.additionalFiles).toHaveLength(1);
		const updatedPackageJson = JSON.parse(result.additionalFiles![0].content);
		expect(updatedPackageJson.devDependencies['@biomejs/biome']).toBe('^2.4.11');
	});

	it('should update pnpm lockfile when updating package.json', async () => {
		const { formatWithBiome } = await import('../../utils/format.js');
		const { fetchFile } = await import('../../github/fetch.js');
		const { formatWithPrettier } = await import('../../utils/format-prettier.js');
		const { generateLockfile, detectPackageManager } = await import('../../utils/lockfile.js');

		vi.mocked(formatWithBiome).mockResolvedValue('{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}');
		vi.mocked(formatWithPrettier).mockImplementation(content => Promise.resolve(content));
		vi.mocked(detectPackageManager).mockReturnValue('pnpm');
		vi.mocked(generateLockfile).mockResolvedValue('lockfileVersion: 9.0\n# updated lockfile content');

		const existingLockfileContent = 'lockfileVersion: 9.0\nold content';

		// Mock fetchFile to return package.json first, then pnpm-lock.yaml
		vi.mocked(fetchFile).mockImplementation(async (owner, repo, path) => {
			if (path === 'package.json') {
				return {
					content: JSON.stringify({
						devDependencies: {
							'@biomejs/biome': '^2.3.0',
						},
					}),
					sha: 'sha',
					path: 'package.json',
					size: 100,
				};
			}
			if (path === 'pnpm-lock.yaml') {
				return {
					content: existingLockfileContent,
					sha: 'sha',
					path: 'pnpm-lock.yaml',
					size: 50,
				};
			}
			throw new Error('File not found');
		});

		const result = await handler.beforePush('{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}', {
			filename: 'biome.json',
			owner: 'owner',
			repo: 'repo',
			branchName: 'branch',
		});

		expect(result.additionalFiles).toHaveLength(2);
		expect(result.additionalFiles![0].path).toBe('package.json');
		expect(result.additionalFiles![1].path).toBe('pnpm-lock.yaml');
		expect(result.additionalFiles![1].reason).toBe('Update lockfile to match package.json changes');
		expect(result.additionalFiles![1].content).toBe('lockfileVersion: 9.0\n# updated lockfile content');

		// Verify generateLockfile was called with existing lockfile
		expect(generateLockfile).toHaveBeenCalledWith(
			expect.any(String), // updatedPackageJson
			'pnpm',
			existingLockfileContent, // ← Existing lockfile passed!
		);
	});

	it('should update npm lockfile when updating package.json', async () => {
		const { formatWithBiome } = await import('../../utils/format.js');
		const { fetchFile } = await import('../../github/fetch.js');
		const { formatWithPrettier } = await import('../../utils/format-prettier.js');
		const { generateLockfile, detectPackageManager } = await import('../../utils/lockfile.js');

		vi.mocked(formatWithBiome).mockResolvedValue('{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}');
		vi.mocked(formatWithPrettier).mockImplementation(content => Promise.resolve(content));
		vi.mocked(detectPackageManager).mockReturnValue('npm');
		vi.mocked(generateLockfile).mockResolvedValue('{"lockfileVersion": 3}');

		const existingNpmLockfile = '{"lockfileVersion": 2}';

		vi.mocked(fetchFile).mockImplementation(async (owner, repo, path) => {
			if (path === 'package.json') {
				return {
					content: JSON.stringify({
						devDependencies: {
							'@biomejs/biome': '^2.3.0',
						},
					}),
					sha: 'sha',
					path: 'package.json',
					size: 100,
				};
			}
			if (path === 'pnpm-lock.yaml') {
				throw new Error('File not found');
			}
			if (path === 'package-lock.json') {
				return {
					content: existingNpmLockfile,
					sha: 'sha',
					path: 'package-lock.json',
					size: 50,
				};
			}
			throw new Error('File not found');
		});

		const result = await handler.beforePush('{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}', {
			filename: 'biome.json',
			owner: 'owner',
			repo: 'repo',
			branchName: 'branch',
		});

		expect(result.additionalFiles).toHaveLength(2);
		expect(result.additionalFiles![1].path).toBe('package-lock.json');

		// Verify generateLockfile was called with existing lockfile
		expect(generateLockfile).toHaveBeenCalledWith(expect.any(String), 'npm', existingNpmLockfile);
	});

	it('should warn when no lockfile is found', async () => {
		const { formatWithBiome } = await import('../../utils/format.js');
		const { fetchFile } = await import('../../github/fetch.js');
		const { formatWithPrettier } = await import('../../utils/format-prettier.js');

		vi.mocked(formatWithBiome).mockResolvedValue('{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}');
		vi.mocked(formatWithPrettier).mockImplementation(content => Promise.resolve(content));

		vi.mocked(fetchFile).mockImplementation(async (owner, repo, path) => {
			if (path === 'package.json') {
				return {
					content: JSON.stringify({
						devDependencies: {
							'@biomejs/biome': '^2.3.0',
						},
					}),
					sha: 'sha',
					path: 'package.json',
					size: 100,
				};
			}
			// All lockfile fetches fail
			throw new Error('File not found');
		});

		const result = await handler.beforePush('{"$schema": "https://biomejs.dev/schemas/2.4.11/schema.json"}', {
			filename: 'biome.json',
			owner: 'owner',
			repo: 'repo',
			branchName: 'branch',
		});

		expect(result.additionalFiles).toHaveLength(1); // Only package.json
		expect(result.additionalFiles![0].path).toBe('package.json');
		expect(result.warnings).toEqual(['No lockfile found - you may need to run your package manager after merging']);
	});
});
