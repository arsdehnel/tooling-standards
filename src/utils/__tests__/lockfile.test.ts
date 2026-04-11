import { describe, expect, it } from 'vitest';
import { detectPackageManager } from '../lockfile.js';

describe('lockfile utilities', () => {
	describe('detectPackageManager', () => {
		it('should detect pnpm from pnpm-lock.yaml', () => {
			expect(detectPackageManager('pnpm-lock.yaml')).toBe('pnpm');
		});

		it('should detect npm from package-lock.json', () => {
			expect(detectPackageManager('package-lock.json')).toBe('npm');
		});

		it('should detect yarn from yarn.lock', () => {
			expect(detectPackageManager('yarn.lock')).toBe('yarn');
		});

		it('should return null for unknown lockfile', () => {
			expect(detectPackageManager('unknown.lock')).toBeNull();
		});
	});

	// Note: generateLockfile is integration-tested since it requires actual package managers
	// We test it indirectly through the biome-handler tests
});
