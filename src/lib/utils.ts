import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom type scale and shadows (tailwind.config.cjs) so `text-body`
// isn't mistaken for a text colour and dropped next to `text-fg`.
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			text: ["micro", "caption", "label", "body", "title", "heading", "display"],
			shadow: ["panel", "popover", "dialog"],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
