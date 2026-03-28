/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				brand: {
					50: "#fffbeb",
					100: "#fef3c7",
					200: "#fde68a",
					300: "#fcd34d",
					400: "#fbbf24",
					500: "#f59e0b",
					600: "#d97706",
					700: "#b45309",
					800: "#92400e",
					900: "#78350f",
					950: "#451a03",
				},
			},
			backgroundImage: {
				"brand-gradient": "linear-gradient(135deg, #d97706, #F59E0B)",
			},
			boxShadow: {
				"glow-sm": "0 0 12px rgba(245, 158, 11, 0.2)",
				"glow-md": "0 0 24px rgba(245, 158, 11, 0.25)",
				"glow-lg": "0 0 40px rgba(245, 158, 11, 0.3)",
				"glow-xl": "0 0 60px rgba(245, 158, 11, 0.35)",
			},
		},
	},
	plugins: [],
};
