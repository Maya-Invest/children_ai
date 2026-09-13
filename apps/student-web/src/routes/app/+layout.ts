import { browser } from "$app/environment";
import { redirect } from "@sveltejs/kit";
import { getToken } from "$lib/session";

export function load() {
	if (browser && !getToken()) {
		throw redirect(302, "/");
	}
}
