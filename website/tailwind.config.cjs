/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				brand: {
					50: "#ecfdf5",
					100: "#d1fae5",
					200: "#a7f3d0",
					300: "#6ee7b7",
					400: "#34d399",
					500: "#10b981",
					600: "#059669",
					700: "#047857",
					800: "#065f46",
					900: "#064e3b",
					950: "#022c22",
				},
			},
			backgroundImage: {
				"brand-gradient": "linear-gradient(135deg, #059669, #10B981)",
			},
			boxShadow: {
				"glow-sm": "0 0 12px rgba(16, 185, 129, 0.2)",
				"glow-md": "0 0 24px rgba(16, 185, 129, 0.25)",
				"glow-lg": "0 0 40px rgba(16, 185, 129, 0.3)",
				"glow-xl": "0 0 60px rgba(16, 185, 129, 0.35)",
			},
		},
	},
	plugins: [],
};
