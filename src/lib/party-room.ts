export const isRoomId = (value: string | null | undefined): value is string =>
	typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);

const hyphenatedRoomCodePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const normalizeRoomCode = (value: string) => {
	const code = value.trim().toLowerCase();
	return hyphenatedRoomCodePattern.test(code) ? code.replaceAll('-', '') : code;
};

export const partyRoomPath = (pathname: string, code: string) =>
	`${pathname}?room=${encodeURIComponent(normalizeRoomCode(code))}`;
