import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BiomeHandler } from '../biome-handler.js';

// Mock dependencies
vi.mock('../../github/fetch.js');
vi.mock('../../utils/format.js');
vi.mock('../../utils/format-prettier.js');

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
});
