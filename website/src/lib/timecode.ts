/** HH:MM:SS:FF at the given frame rate. */
export function formatTimecode(seconds: number, fps = 24) {
	const s = Math.max(0, seconds);
	const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
	return `${pad(s / 3600)}:${pad((s / 60) % 60)}:${pad(s % 60)}:${pad((s % 1) * fps)}`;
}
