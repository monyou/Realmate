import { describe, expect, it } from 'vitest';
import { parseMediaUrl } from './media';

describe('parseMediaUrl', () => {
	it('accepts public HTTP and HTTPS links', () => {
		expect(parseMediaUrl('https://example.com/movies.json').toString()).toBe(
			'https://example.com/movies.json'
		);
		expect(parseMediaUrl('http://8.8.8.8/movies.json').hostname).toBe('8.8.8.8');
	});

	it.each([
		'file:///tmp/movies.json',
		'http://localhost/movies.json',
		'http://127.0.0.1/movies.json',
		'http://10.0.0.4/movies.json',
		'http://169.254.169.254/latest/meta-data',
		'http://192.168.1.10/movies.json',
		'http://[::1]/movies.json'
	])('rejects a non-public source: %s', (source) => {
		expect(() => parseMediaUrl(source)).toThrow();
	});
});
