import type { MediaItem } from '$lib/types';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type SourceMedia = Omit<MediaItem, 'id'>[];

export const maxMediaBytes = 2 * 1024 * 1024;

const isPrivateIpv4 = (hostname: string) => {
	const [first, second] = hostname.split('.').map(Number);
	return (
		first === 0 ||
		first === 10 ||
		(first === 100 && second >= 64 && second <= 127) ||
		first === 127 ||
		(first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 0) ||
		(first === 192 && second === 168) ||
		(first === 198 && (second === 18 || second === 19)) ||
		first >= 224
	);
};

const isPrivateIpv6 = (hostname: string) => {
	const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
	return (
		normalized === '::' ||
		normalized === '::1' ||
		normalized.startsWith('fc') ||
		normalized.startsWith('fd') ||
		/^fe[89ab]/.test(normalized) ||
		normalized.startsWith('ff') ||
		normalized.startsWith('2001:db8:') ||
		(normalized.startsWith('::ffff:') && isPrivateIpv4(normalized.slice(7)))
	);
};

const isPrivateAddress = (address: string) => {
	const version = isIP(address);
	return (version === 4 && isPrivateIpv4(address)) || (version === 6 && isPrivateIpv6(address));
};

export const parseMediaUrl = (source: string) => {
	let url: URL;
	try {
		url = new URL(source);
	} catch {
		throw new Error('Enter a valid link to a public JSON file.');
	}

	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
		throw new Error('The movie list must use a public HTTP or HTTPS link.');
	}

	const hostname = url.hostname.toLowerCase();
	const ipVersion = isIP(hostname.replace(/^\[|\]$/g, ''));
	if (
		hostname === 'localhost' ||
		hostname.endsWith('.localhost') ||
		hostname.endsWith('.local') ||
		hostname.endsWith('.internal') ||
		(ipVersion === 4 && isPrivateIpv4(hostname)) ||
		(ipVersion === 6 && isPrivateIpv6(hostname))
	) {
		throw new Error('The movie list must be hosted at a public address.');
	}

	return url;
};

const assertPublicHost = async (url: URL) => {
	if (isIP(url.hostname.replace(/^\[|\]$/g, ''))) return;
	let addresses;
	try {
		addresses = await lookup(url.hostname, { all: true, verbatim: true });
	} catch {
		throw new Error('The movie-list host could not be found.');
	}
	if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
		throw new Error('The movie list must be hosted at a public address.');
	}
};

const fetchMediaResponse = async (source: string) => {
	let url = parseMediaUrl(source);
	for (let redirect = 0; redirect <= 3; redirect += 1) {
		await assertPublicHost(url);
		const response = await fetch(url, {
			cache: 'no-store',
			headers: { accept: 'application/json' },
			redirect: 'manual',
			signal: AbortSignal.timeout(7_000)
		});
		if (response.status < 300 || response.status >= 400) return response;

		const location = response.headers.get('location');
		if (!location) throw new Error('The movie-list link redirected without a destination.');
		if (redirect === 3) throw new Error('The movie-list link redirected too many times.');
		url = parseMediaUrl(new URL(location, url).toString());
	}
	throw new Error('The movie list could not be downloaded.');
};

export const loadMedia = async (source: string): Promise<SourceMedia> => {
	const response = await fetchMediaResponse(source);
	if (!response.ok) {
		throw new Error(`The movie list could not be downloaded (${response.status}).`);
	}

	const contentLength = Number(response.headers.get('content-length'));
	if (Number.isFinite(contentLength) && contentLength > maxMediaBytes) {
		throw new Error('The movie list is too large. The maximum size is 2 MB.');
	}

	const body = await response.text();
	if (new TextEncoder().encode(body).byteLength > maxMediaBytes) {
		throw new Error('The movie list is too large. The maximum size is 2 MB.');
	}

	let media: unknown;
	try {
		media = JSON.parse(body);
	} catch {
		throw new Error('The supplied file is not valid JSON.');
	}
	if (!Array.isArray(media)) throw new Error('The JSON file must contain an array of movies.');
	return media as SourceMedia;
};
