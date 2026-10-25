import { browser } from "$app/environment";
import { redirect } from "@sveltejs/kit";
import { loadHome } from "$lib/api";
import { getToken } from "$lib/session";

export function load() {
	if (browser && !getToken()) {
		throw redirect(302, "/");
	}
	return { home: loadHome() };
}
