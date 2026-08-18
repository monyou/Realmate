import type { Cookies } from '@sveltejs/kit';

const playerCookie = 'realmate-player';

export const getPlayerIdentity = (cookies: Cookies, secure: boolean) => {
	let playerId = cookies.get(playerCookie);
	if (!playerId || !/^[0-9a-f-]{36}$/i.test(playerId)) playerId = crypto.randomUUID();
	cookies.set(playerCookie, playerId, {
		httpOnly: true,
		sameSite: 'lax',
		secure,
		path: '/',
		maxAge: 60 * 60 * 24 * 365
	});
	return playerId;
};
