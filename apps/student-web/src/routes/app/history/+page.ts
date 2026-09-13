import { loadHome } from "$lib/api";

export async function load() {
	return { home: await loadHome() };
}
