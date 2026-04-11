import { describe, expect, it } from 'vitest';
import { applyJsonPropertyChanges, compareJsonByProperty } from '../json-diff.js';

describe('json-diff', () => {
	describe('compareJsonByProperty', () => {
		it('should return null for invalid JSON', () => {
			const result = compareJsonByProperty('not json', '{"valid": true}');
			expect(result).toBeNull();
		});

		it('should return null for non-object JSON (arrays)', () => {
			const result = compareJsonByProperty('[1, 2, 3]', '[4, 5, 6]');
			expect(result).toBeNull();
		});

		it('should return null for non-object JSON (primitives)', () => {
			const result = compareJsonByProperty('"string"', '"other"');
			expect(result).toBeNull();
		});

		it('should return empty array when objects are identical', () => {
			const obj = JSON.stringify({ a: 1, b: 2 });
			const result = compareJsonByProperty(obj, obj);
			expect(result).toEqual([]);
		});

		it('should detect added properties', () => {
			const oldJson = JSON.stringify({ a: 1 });
			const newJson = JSON.stringify({ a: 1, b: 2 });
			const result = compareJsonByProperty(oldJson, newJson);

			expect(result).toHaveLength(1);
			expect(result![0]).toEqual({
				type: 'added',
				key: 'b',
				newValue: 2,
			});
		});

		it('should detect removed properties', () => {
			const oldJson = JSON.stringify({ a: 1, b: 2 });
			const newJson = JSON.stringify({ a: 1 });
			const result = compareJsonByProperty(oldJson, newJson);

			expect(result).toHaveLength(1);
			expect(result![0]).toEqual({
				type: 'removed',
				key: 'b',
				oldValue: 2,
			});
		});

		it('should detect modified properties', () => {
			const oldJson = JSON.stringify({ a: 1 });
			const newJson = JSON.stringify({ a: 2 });
			const result = compareJsonByProperty(oldJson, newJson);

			expect(result).toHaveLength(1);
			expect(result![0]).toEqual({
				type: 'modified',
				key: 'a',
				oldValue: 1,
				newValue: 2,
			});
		});

		it('should detect multiple changes', () => {
			const oldJson = JSON.stringify({ a: 1, b: 2, c: 3 });
			const newJson = JSON.stringify({ a: 1, b: 'changed', d: 4 });
			const result = compareJsonByProperty(oldJson, newJson);

			expect(result).toHaveLength(3);

			// Find specific changes
			const modified = result!.find(c => c.type === 'modified');
			const removed = result!.find(c => c.type === 'removed');
			const added = result!.find(c => c.type === 'added');

			expect(modified).toEqual({
				type: 'modified',
				key: 'b',
				oldValue: 2,
				newValue: 'changed',
			});

			expect(removed).toEqual({
				type: 'removed',
				key: 'c',
				oldValue: 3,
			});

			expect(added).toEqual({
				type: 'added',
				key: 'd',
				newValue: 4,
			});
		});

		it('should handle nested objects', () => {
			const oldJson = JSON.stringify({ a: { b: 1 } });
			const newJson = JSON.stringify({ a: { b: 2 } });
			const result = compareJsonByProperty(oldJson, newJson);

			expect(result).toHaveLength(1);
			expect(result![0]).toEqual({
				type: 'modified',
				key: 'a',
				oldValue: { b: 1 },
				newValue: { b: 2 },
			});
		});

		it('should handle arrays as values', () => {
			const oldJson = JSON.stringify({ items: [1, 2, 3] });
			const newJson = JSON.stringify({ items: [1, 2, 3, 4] });
			const result = compareJsonByProperty(oldJson, newJson);

			expect(result).toHaveLength(1);
			expect(result![0]).toEqual({
				type: 'modified',
				key: 'items',
				oldValue: [1, 2, 3],
				newValue: [1, 2, 3, 4],
			});
		});
	});

	describe('applyJsonPropertyChanges', () => {
		it('should apply added properties', () => {
			const oldJson = JSON.stringify({ a: 1 });
			const changes = [
				{
					type: 'added' as const,
					key: 'b',
					newValue: 2,
				},
			];

			const result = applyJsonPropertyChanges(oldJson, changes);
			const parsed = JSON.parse(result);

			expect(parsed).toEqual({ a: 1, b: 2 });
		});

		it('should apply removed properties', () => {
			const oldJson = JSON.stringify({ a: 1, b: 2 });
			const changes = [
				{
					type: 'removed' as const,
					key: 'b',
					oldValue: 2,
				},
			];

			const result = applyJsonPropertyChanges(oldJson, changes);
			const parsed = JSON.parse(result);

			expect(parsed).toEqual({ a: 1 });
		});

		it('should apply modified properties', () => {
			const oldJson = JSON.stringify({ a: 1 });
			const changes = [
				{
					type: 'modified' as const,
					key: 'a',
					oldValue: 1,
					newValue: 2,
				},
			];

			const result = applyJsonPropertyChanges(oldJson, changes);
			const parsed = JSON.parse(result);

			expect(parsed).toEqual({ a: 2 });
		});

		it('should apply multiple changes', () => {
			const oldJson = JSON.stringify({ a: 1, b: 2, c: 3 });
			const changes = [
				{
					type: 'modified' as const,
					key: 'a',
					oldValue: 1,
					newValue: 10,
				},
				{
					type: 'removed' as const,
					key: 'b',
					oldValue: 2,
				},
				{
					type: 'added' as const,
					key: 'd',
					newValue: 4,
				},
			];

			const result = applyJsonPropertyChanges(oldJson, changes);
			const parsed = JSON.parse(result);

			expect(parsed).toEqual({ a: 10, c: 3, d: 4 });
		});

		it('should preserve unchanged properties', () => {
			const oldJson = JSON.stringify({ a: 1, b: 2, c: 3 });
			const changes = [
				{
					type: 'modified' as const,
					key: 'b',
					oldValue: 2,
					newValue: 20,
				},
			];

			const result = applyJsonPropertyChanges(oldJson, changes);
			const parsed = JSON.parse(result);

			expect(parsed).toEqual({ a: 1, b: 20, c: 3 });
		});
	});
});
