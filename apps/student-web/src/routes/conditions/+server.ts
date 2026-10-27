import type { RequestHandler } from './$types';

const SOURCE = 'https://edayaplus.com/conditions-utilisation/';
const ORIGIN = 'https://edayaplus.com';

function documentPage(body: string): string {
	return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;700;800&display=swap" />
<style>
	body { margin: 0; padding: 1.25rem 1.5rem 2.5rem; font-family: Nunito, system-ui, sans-serif; color: #2a1810; background: #fffdf8; line-height: 1.55; }
	h1 { font-size: 1.6rem; line-height: 1.2; }
	h2 { font-size: 1.15rem; margin-top: 1.6rem; }
	a { color: #1f6f62; }
	ul { padding-left: 1.25rem; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function extractTerms(html: string): string | null {
	const start = html.indexOf('<main class="legal">');
	const end = html.indexOf('</main>', start);
	if (start < 0 || end < 0) return null;
	return html
		.slice(start, end + '</main>'.length)
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<a class="legal-back"[\s\S]*?<\/a>/i, '')
		.replace(
			/href="(\/[^"]*)"/g,
			(_match, path: string) => `href="${ORIGIN}${path}" target="_blank" rel="noopener"`
		);
}

function htmlResponse(body: string, status = 200): Response {
	return new Response(documentPage(body), {
		status,
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'cache-control': status === 200 ? 'public, max-age=300' : 'no-store'
		}
	});
}

export const GET: RequestHandler = async () => {
	try {
		const response = await fetch(SOURCE);
		if (!response.ok) throw new Error('unavailable');
		const main = extractTerms(await response.text());
		if (!main) throw new Error('unexpected page');
		return htmlResponse(main);
	} catch {
		return htmlResponse(
			`<p>Les conditions d’utilisation sont indisponibles.</p><p><a href="${SOURCE}" target="_blank" rel="noopener">Ouvrir la page complète</a></p>`,
			502
		);
	}
};
