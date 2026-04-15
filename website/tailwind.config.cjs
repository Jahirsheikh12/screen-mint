/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ["class"],
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
				surface: {
					0: "#121212",
					1: "#1a1a1a",
					2: "#1f1f1f",
					3: "#242424",
					4: "#2a2a2a",
				},
			},
			backgroundImage: {
				"brand-gradient": "linear-gradient(135deg, #d97706, #F59E0B)",
			},
			boxShadow: {
				"glow-sm": "0 0 12px rgba(245, 158, 11, 0.25)",
				"glow-md": "0 0 24px rgba(245, 158, 11, 0.3)",
				"glow-lg": "0 0 40px rgba(245, 158, 11, 0.35)",
				"glow-xl": "0 0 60px rgba(245, 158, 11, 0.4)",
			},
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
				"fade-in": {
					from: { opacity: "0" },
					to: { opacity: "1" },
				},
				"slide-up": {
					from: { opacity: "0", transform: "translateY(24px)" },
					to: { opacity: "1", transform: "translateY(0)" },
				},
				"gradient-x": {
					"0%, 100%": { "background-position": "0% 50%" },
					"50%": { "background-position": "100% 50%" },
				},
				float: {
					"0%, 100%": { transform: "translateY(0)" },
					"50%": { transform: "translateY(-10px)" },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				"fade-in": "fade-in 0.6s ease-out forwards",
				"slide-up": "slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
				"gradient-x": "gradient-x 3s ease infinite",
				float: "float 6s ease-in-out infinite",
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
