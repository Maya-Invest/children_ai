import { loadSet } from "$lib/api";

export async function load({ params }: { params: { id: string } }) {
	const payload = await loadSet(params.id);
	return { set: payload.set };
}
