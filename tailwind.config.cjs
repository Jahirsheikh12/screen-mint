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
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				"fade-in": "fade-in 0.35s ease-out",
				"slide-up": "slide-up 0.35s ease-out",
				"scale-in": "scale-in 0.2s ease-out",
			},
			borderRadius: {
				sm: "6px",
				md: "8px",
				lg: "10px",
				xl: "14px",
			},
			// Semantic tokens; values per theme live in src/index.css.
			colors: {
				canvas: "rgb(var(--canvas) / <alpha-value>)",
				surface: "rgb(var(--surface) / <alpha-value>)",
				raised: "rgb(var(--raised) / <alpha-value>)",
				sunken: "rgb(var(--sunken) / <alpha-value>)",
				stage: "rgb(var(--stage) / <alpha-value>)",
				scrim: "rgb(var(--scrim) / <alpha-value>)",
				track: "rgb(var(--track) / <alpha-value>)",
				fg: {
					DEFAULT: "rgb(var(--fg) / <alpha-value>)",
					muted: "rgb(var(--fg-muted) / <alpha-value>)",
					subtle: "rgb(var(--fg-subtle) / <alpha-value>)",
					disabled: "rgb(var(--fg-disabled) / <alpha-value>)",
				},
				line: {
					DEFAULT: "var(--line)",
					strong: "var(--line-strong)",
				},
				fill: {
					subtle: "var(--fill-subtle)",
					hover: "var(--fill-hover)",
					pressed: "var(--fill-pressed)",
				},
				accent: {
					DEFAULT: "rgb(var(--accent) / <alpha-value>)",
					hover: "rgb(var(--accent-hover) / <alpha-value>)",
					fg: "rgb(var(--accent-fg) / <alpha-value>)",
				},
				"on-accent": "rgb(var(--on-accent) / <alpha-value>)",
				// Literal white in both themes: text on danger fills, knobs, QR codes.
				"on-danger": "rgb(255 255 255 / <alpha-value>)",
				"fixed-white": "rgb(255 255 255 / <alpha-value>)",
				// Selected segment / pill sitting on a fill-hover track.
				control: "rgb(var(--control) / <alpha-value>)",
				danger: {
					DEFAULT: "rgb(var(--danger) / <alpha-value>)",
					fg: "rgb(var(--danger-fg) / <alpha-value>)",
				},
				success: {
					DEFAULT: "rgb(var(--success) / <alpha-value>)",
					fg: "rgb(var(--success-fg) / <alpha-value>)",
				},
				warning: {
					DEFAULT: "rgb(var(--warning) / <alpha-value>)",
					fg: "rgb(var(--warning-fg) / <alpha-value>)",
				},
				info: {
					DEFAULT: "rgb(var(--info) / <alpha-value>)",
					fg: "rgb(var(--info-fg) / <alpha-value>)",
				},
			},
			boxShadow: {
				panel: "var(--shadow-panel)",
				popover: "var(--shadow-popover)",
				dialog: "var(--shadow-dialog)",
			},
			fontSize: {
				micro: ["10px", { lineHeight: "14px" }],
				caption: ["11px", { lineHeight: "16px" }],
				label: ["12px", { lineHeight: "16px" }],
				body: ["13px", { lineHeight: "18px" }],
				title: ["14px", { lineHeight: "20px" }],
				heading: ["16px", { lineHeight: "22px" }],
				display: ["22px", { lineHeight: "28px" }],
			},
			transitionDuration: {
				fast: "120ms",
				base: "180ms",
				slow: "260ms",
			},
			transitionTimingFunction: {
				standard: "var(--ease-standard)",
				emphasized: "var(--ease-emphasized)",
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
