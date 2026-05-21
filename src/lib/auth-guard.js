import { goto } from '$app/navigation';
import { getSupabase } from '$lib/supabase';
import { authUser, waitForAuthReady } from './auth-store';
import { get } from 'svelte/store';

export async function requireUser(redirectTo = '/signin') {
	const supabase = getSupabase();
	if (!supabase) return null;

	await waitForAuthReady(8000);

	let user = get(authUser);

	if (!user) {
		try {
			const {
				data: { user: freshUser }
			} = await supabase.auth.getUser();

			user = freshUser ?? null;
		} catch {
			user = null;
		}
	}

	if (!user) {
		await goto(redirectTo);
		return null;
	}

	return { supabase, user };
}
