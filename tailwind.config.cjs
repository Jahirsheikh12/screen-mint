/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ["class"],
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
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
					from: { opacity: "0", transform: "translateY(8px)" },
					to: { opacity: "1", transform: "translateY(0)" },
				},
				"scale-in": {
					from: { opacity: "0", transform: "scale(0.95)" },
					to: { opacity: "1", transform: "scale(1)" },
				},
				"glow-pulse": {
					"0%, 100%": { boxShadow: "0 0 8px rgba(245, 158, 11, 0.25)" },
					"50%": { boxShadow: "0 0 20px rgba(245, 158, 11, 0.4)" },
				},
				breathe: {
					"0%, 100%": { opacity: "0.4" },
					"50%": { opacity: "0.7" },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				"fade-in": "fade-in 0.35s ease-out",
				"slide-up": "slide-up 0.35s ease-out",
				"scale-in": "scale-in 0.2s ease-out",
				"glow-pulse": "glow-pulse 2s ease-in-out infinite",
				breathe: "breathe 3s ease-in-out infinite",
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
			colors: {
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
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
				glass: {
					DEFAULT: "rgba(245, 158, 11, 0.06)",
					border: "rgba(245, 158, 11, 0.15)",
					hover: "rgba(245, 158, 11, 0.1)",
				},
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				chart: {
					1: "hsl(var(--chart-1))",
					2: "hsl(var(--chart-2))",
					3: "hsl(var(--chart-3))",
					4: "hsl(var(--chart-4))",
					5: "hsl(var(--chart-5))",
				},
			},
			backgroundImage: {
				"brand-gradient": "linear-gradient(135deg, #F59E0B, #F97316)",
			},
			boxShadow: {
				"glow-sm": "0 0 8px rgba(245, 158, 11, 0.25)",
				"glow-md": "0 0 16px rgba(245, 158, 11, 0.3)",
				"glow-lg": "0 0 24px rgba(245, 158, 11, 0.4)",
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
