import { createApp } from "./compose.ts";

const results = await createApp().syncLinkedSnapshots();
console.log(JSON.stringify({ ok: true, results }, null, 2));
