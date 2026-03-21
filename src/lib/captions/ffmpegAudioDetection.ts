export function ffmpegOutputHasAudioStream(output: string): boolean {
	if (!output) {
		return false;
	}

	return /\bStream\s+#.*\bAudio:/im.test(output) || output.includes("Audio:");
}
