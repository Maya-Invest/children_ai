import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const webOrigin = process.env.CHILDREN_AI_WEB_ORIGIN;
if (!webOrigin) throw new Error("CHILDREN_AI_WEB_ORIGIN is required");

const browser = await chromium.launch({ headless: true, timeout: 20_000 });
const page = await browser.newPage();
page.setDefaultTimeout(30_000);
const notes = [];
page.on("console", (message) => {
	if (message.type() === "error") notes.push(message.text());
});
page.on("pageerror", (error) => notes.push(String(error)));
page.on("requestfailed", (request) => {
	notes.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "failed"}`);
});
page.on("response", (response) => {
	if (response.status() >= 400) notes.push(`${response.status()} ${response.url()}`);
});

try {
	console.log("1. Open the landing page");
	await page.goto(webOrigin);
	await page.getByRole("link", { name: "Me connecter" }).click();

	console.log("2. Parent signs in with the Edaya one-time code");
	await page.getByRole("button", { name: "Recevoir un code" }).click();
	await page.getByRole("button", { name: "Afficher le code" }).click();
	await page.getByRole("button", { name: "Se connecter" }).click();
	await page.getByRole("heading", { name: "Bonjour Mariam Koné" }).waitFor();
	await page.getByText("Aminata Koné").waitFor();
	await page.getByText("Yao Koffi").waitFor();

	console.log("3. Parent issues Aminata's access code");
	await page.getByRole("button", { name: "Générer un code" }).first().click();
	const revealed = await page.getByText(/Code \(une seule fois\)/).textContent();
	const code = revealed?.match(/[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}/)?.[0];
	if (!code) throw new Error("The parent screen did not show an access code");

	console.log("4. Student enters the code");
	await page.goto(`${webOrigin}/student`);
	await page.getByLabel("Code élève").fill(code);
	await page.getByRole("button", { name: "Entrer" }).click();
	await page.waitForURL("**/app**");

	console.log("5. Student home shows the live class, then generates once");
	await page.getByText("Mathématiques").first().waitFor();
	await page.getByText("6ème").first().waitFor();
	await page.getByRole("button", { name: "Générer" }).first().click();
	await page.getByRole("link", { name: "Répondre" }).waitFor();
	console.log("UI journey passed");
} catch (error) {
	console.error("URL", page.url());
	if (notes.length > 0) console.error(notes.join("\n"));
	console.error(await page.locator("body").innerText().catch(() => ""));
	const evidence = path.join(process.cwd(), ".ci-evidence");
	mkdirSync(evidence, { recursive: true });
	await page.screenshot({ path: path.join(evidence, "ui-failure.png"), fullPage: true }).catch(() => {});
	console.error(error);
	process.exitCode = 1;
} finally {
	process.exit(process.exitCode ?? 0);
}
