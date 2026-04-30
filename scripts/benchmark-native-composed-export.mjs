import { spawn, spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);

const scenarios = [
	{ name: "1080p30", width: 1920, height: 1080, fps: 30, durationSec: 8 },
	{ name: "1440p60", width: 2560, height: 1440, fps: 60, durationSec: 6 },
];

const args = parseArgs(process.argv.slice(2));
const ffmpegPath = args.ffmpeg ?? require("ffmpeg-static");
const outputDir = args.outputDir ?? path.join(os.tmpdir(), "screenmint-native-composed-bench");

await mkdir(outputDir, { recursive: true });

const encoders = args.encoder ? [args.encoder] : chooseEncoders(ffmpegPath);
console.log(`FFmpeg: ${ffmpegPath}`);
console.log(`Encoders: ${encoders.join(", ")}`);
console.log(`Output: ${outputDir}`);

for (const scenario of scenarios) {
	const sourcePath =
		args.source ?? path.join(outputDir, `screenmint-benchmark-source-${scenario.name}.mp4`);
	if (!args.source) {
		await generateSource(ffmpegPath, sourcePath, scenario);
	}

	const outputPath = path.join(outputDir, `screenmint-native-composed-${scenario.name}.mp4`);
	await rm(outputPath, { force: true }).catch(() => undefined);
	const result = await runFirstAvailableEncoder(
		ffmpegPath,
		sourcePath,
		outputPath,
		encoders,
		scenario,
	);
	const target = scenario.name === "1080p30" ? "target >= 120 fps" : "best effort";
	console.log(
		`${scenario.name}: ${result.throughputFps.toFixed(1)} fps throughput with ${result.encoder} (${target}, ${result.elapsedMs.toFixed(0)} ms)`,
	);
}

function parseArgs(argv) {
	const parsed = {};
	for (let index = 0; index < argv.length; index += 1) {
		const value = argv[index];
		if (value === "--ffmpeg") parsed.ffmpeg = argv[++index];
		else if (value === "--encoder") parsed.encoder = argv[++index];
		else if (value === "--source") parsed.source = argv[++index];
		else if (value === "--output-dir") parsed.outputDir = argv[++index];
	}
	return parsed;
}

function chooseEncoders(ffmpeg) {
	const probe = spawnSync(ffmpeg, ["-hide_banner", "-encoders"], { encoding: "utf8" });
	const encoders = `${probe.stdout ?? ""}\n${probe.stderr ?? ""}`;
	return ["h264_videotoolbox", "h264_nvenc", "h264_qsv", "h264_amf", "libx264"].filter(
		(encoder) => encoder === "libx264" || encoders.includes(encoder),
	);
}

async function generateSource(ffmpeg, sourcePath, scenario) {
	const result = spawnSync(
		ffmpeg,
		[
			"-y",
			"-hide_banner",
			"-f",
			"lavfi",
			"-i",
			`testsrc2=size=${scenario.width}x${scenario.height}:rate=${scenario.fps}:duration=${scenario.durationSec}`,
			"-f",
			"lavfi",
			"-i",
			`sine=frequency=880:duration=${scenario.durationSec}`,
			"-c:v",
			"libx264",
			"-preset",
			"ultrafast",
			"-pix_fmt",
			"yuv420p",
			"-c:a",
			"aac",
			"-shortest",
			sourcePath,
		],
		{ encoding: "utf8" },
	);
	if (result.status !== 0) {
		throw new Error(result.stderr || `Failed to generate ${scenario.name} source.`);
	}
}

async function runFirstAvailableEncoder(ffmpeg, sourcePath, outputPath, encoders, scenario) {
	const failures = [];
	for (const encoder of encoders) {
		await rm(outputPath, { force: true }).catch(() => undefined);
		try {
			return await runNativeComposedBenchmark(ffmpeg, sourcePath, outputPath, encoder, scenario);
		} catch (error) {
			failures.push(`${encoder}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	throw new Error(`All benchmark encoders failed for ${scenario.name}:\n${failures.join("\n")}`);
}

async function runNativeComposedBenchmark(ffmpeg, sourcePath, outputPath, encoder, scenario) {
	const zoom = `if(between(t\\,1.000\\,${Math.min(3, scenario.durationSec).toFixed(3)})\\,1.5\\,1)`;
	const frameWidth = even(scenario.width * 0.82);
	const frameHeight = even(scenario.height * 0.82);
	const frameX = even((scenario.width - frameWidth) / 2);
	const frameY = even((scenario.height - frameHeight) / 2);
	const filter = [
		`color=c=0x111827:s=${scenario.width}x${scenario.height}:r=${scenario.fps}:d=${scenario.durationSec}[bg]`,
		`[0:v]crop=iw*0.9:ih*0.9:iw*0.05:ih*0.05,setsar=1,scale='${frameWidth}*${zoom}':'${frameHeight}*${zoom}':eval=frame:flags=lanczos,fps=${scenario.fps}[nativev]`,
		`[bg][nativev]overlay=x='${frameX}-(${frameWidth}*(${zoom}-1)*0.5)':y='${frameY}-(${frameHeight}*(${zoom}-1)*0.5)':eval=frame:shortest=1,drawtext=text='Native composed benchmark':x=(w-text_w)/2:y=h-text_h-72:fontsize=${Math.max(28, Math.round(scenario.height * 0.035))}:fontcolor=white:box=1:boxcolor=black@0.45,format=yuv420p[outv]`,
	].join(";");
	const command = [
		"-y",
		"-hide_banner",
		"-nostats",
		"-i",
		sourcePath,
		"-filter_complex",
		filter,
		"-map",
		"[outv]",
		"-map",
		"0:a?",
		...encoderArgs(encoder, scenario),
		outputPath,
	];
	const start = performance.now();
	const result = await run(ffmpeg, command);
	const elapsedMs = performance.now() - start;
	if (result.code !== 0) {
		throw new Error(result.stderr || `Benchmark export failed for ${scenario.name}.`);
	}
	return {
		encoder,
		elapsedMs,
		throughputFps: (scenario.durationSec * scenario.fps * 1000) / Math.max(elapsedMs, 1),
	};
}

function encoderArgs(encoder, scenario) {
	const args = ["-c:v", encoder];
	if (encoder === "libx264") {
		args.push("-preset", "veryfast", "-profile:v", "high", "-crf", "18");
	} else {
		args.push("-b:v", String(scenario.width >= 2560 ? 24_000_000 : 12_000_000));
		if (encoder === "h264_videotoolbox") args.push("-allow_sw", "1");
	}
	args.push(
		"-g",
		String(scenario.fps * 2),
		"-pix_fmt",
		"yuv420p",
		"-colorspace",
		"bt709",
		"-color_primaries",
		"bt709",
		"-color_trc",
		"bt709",
		"-c:a",
		"aac",
		"-b:a",
		"192k",
		"-movflags",
		"+faststart",
	);
	return args;
}

function run(command, commandArgs) {
	return new Promise((resolve) => {
		const child = spawn(command, commandArgs, { windowsHide: true });
		let stderr = "";
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", (error) => resolve({ code: 1, stderr: error.message }));
		child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
	});
}

function even(value) {
	const rounded = Math.max(2, Math.round(value));
	return rounded % 2 === 0 ? rounded : rounded - 1;
}
