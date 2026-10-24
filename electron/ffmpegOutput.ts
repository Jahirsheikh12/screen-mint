/** Latest encoded position in seconds found in a piece of FFmpeg `-progress` / stats output. */
export function parseFfmpegProgressSeconds(output: string) {
	const outTimeMsMatches = [...output.matchAll(/out_time_ms=(\d+)/g)];
	const latestOutTimeMs = outTimeMsMatches[outTimeMsMatches.length - 1];
	if (latestOutTimeMs) {
		return Number(latestOutTimeMs[1]) / 1_000_000;
	}

	const outTimeMatches = [...output.matchAll(/out_time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
	const latestOutTime = outTimeMatches[outTimeMatches.length - 1];
	if (latestOutTime) {
		return (
			Number(latestOutTime[1]) * 3600 + Number(latestOutTime[2]) * 60 + Number(latestOutTime[3])
		);
	}

	const timeMatches = [...output.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
	const latest = timeMatches[timeMatches.length - 1];
	if (!latest) {
		return 0;
	}

	return Number(latest[1]) * 3600 + Number(latest[2]) * 60 + Number(latest[3]);
}

/**
 * The useful part of a failed FFmpeg run: its last lines without the `key=value` progress
 * records that `-progress pipe:2` interleaves, which otherwise hide the actual error.
 */
export function summarizeFfmpegError(stderrTail: string, exitCode: number | null): string {
	const lines = stderrTail
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !/^\w+=/.test(line));
	return lines.slice(-8).join("\n") || `FFmpeg export failed with code ${exitCode ?? "unknown"}`;
}
