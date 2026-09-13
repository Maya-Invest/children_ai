/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{html,js,svelte,ts}"],
	theme: {
		extend: {
			colors: {
				cream: "#FBF4E8",
				ink: "#2A1810",
				clay: "#E06C3A",
				forest: "#1F6F62",
				gold: "#E8B84A",
				paper: "#FFFDF8",
			},
			fontFamily: {
				display: ["Nunito", "ui-rounded", "system-ui", "sans-serif"],
				body: ["Nunito", "system-ui", "sans-serif"],
			},
			boxShadow: {
				card: "0 18px 40px -24px rgba(42, 24, 16, 0.35)",
			},
		},
	},
	plugins: [],
};
