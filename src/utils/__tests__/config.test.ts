import { describe, expect, it } from 'vitest';
import { parseRepository } from '../config.js';

describe('config utilities', () => {
	describe('parseRepository', () => {
		it('should parse valid owner/repo format', () => {
			const result = parseRepository('arsdehnel/my-project');
			expect(result).toEqual({
				owner: 'arsdehnel',
				repo: 'my-project',
			});
		});

		it('should parse repo with hyphens and underscores', () => {
			const result = parseRepository('kad-products/rezept_core');
			expect(result).toEqual({
				owner: 'kad-products',
				repo: 'rezept_core',
			});
		});

		it('should throw error for invalid format (no slash)', () => {
			expect(() => parseRepository('invalid-repo')).toThrow('Invalid repository format: invalid-repo');
		});

		it('should throw error for invalid format (too many slashes)', () => {
			expect(() => parseRepository('owner/org/repo')).toThrow('Invalid repository format: owner/org/repo');
		});

		it('should throw error for empty string', () => {
			expect(() => parseRepository('')).toThrow('Invalid repository format: ');
		});
	});

	// Note: readConfig() requires filesystem access and is integration-tested
	// through the scan command tests
});
