// @ts-nocheck
import * as auth from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load = async (event: Parameters<PageServerLoad>[0]) => {
	if (!event.locals.user) {
		return redirect(302, '/demo/lucia/login');
	}
	return { user: event.locals.user };
};

export const actions = {
	logout: async (event: import('./$types').RequestEvent) => {
		if (!event.locals.session) {
			return fail(401);
		}
		await auth.invalidateSession(event.locals.session.id);
		auth.deleteSessionTokenCookie(event);

		return redirect(302, '/demo/lucia/login');
	}
};
;null as any as Actions;