// Bakes the rendered landing page and its structured data into dist/index.html after `vite build`.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ssrDir = path.join(websiteRoot, "dist-ssr");
const htmlPath = path.join(websiteRoot, "dist", "index.html");

const { render, structuredData } = await import(
	pathToFileURL(path.join(ssrDir, "entry-server.js")).href
);

const ROOT = '<div id="root"></div>';
let html = readFileSync(htmlPath, "utf8");
if (!html.includes(ROOT) || !html.includes("</head>")) {
	throw new Error("prerender: dist/index.html is missing the empty #root or </head> marker");
}

// Escape "<" so no answer text can close the script tag early.
const jsonLd = JSON.stringify(structuredData()).replace(/</g, "\\u003c");
html = html
	.replace(ROOT, `<div id="root">${render()}</div>`)
	.replace("</head>", `<script type="application/ld+json">${jsonLd}</script>\n  </head>`);

writeFileSync(htmlPath, html);
rmSync(ssrDir, { recursive: true, force: true });
console.log("prerender: wrote static HTML and structured data to dist/index.html");
