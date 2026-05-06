import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import https from "node:https";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import os from "node:os";
import { BrowserWindow, ipcMain } from "electron";
import {
	IPC_CHANNELS,
	type IpcFailureResult,
	type MobileCaptureIceCandidatePayload,
	type MobileCapturePairingState,
	type MobileCaptureSignalPayload,
} from "../../src/electron-ipc/contracts";

const nodeRequire = createRequire(import.meta.url);
const QRCode = nodeRequire("qrcode") as typeof import("qrcode");
const selfsigned = nodeRequire("selfsigned") as typeof import("selfsigned");

const PAIRING_TTL_MS = 10 * 60 * 1000;
const MOBILE_PAGE_PATH_PREFIX = "/mobile-capture/";
const MAX_BODY_BYTES = 1024 * 1024;

type MobileCaptureSession = {
	id: string;
	token: string;
	expiresAt: number;
	status: MobileCapturePairingState["status"];
	pairingUrl: string;
	qrSvg: string;
	lanAddress: string;
	desktopOffer: MobileCaptureSignalPayload | null;
	phoneAnswer: MobileCaptureSignalPayload | null;
	desktopIceCandidates: MobileCaptureIceCandidatePayload[];
	phoneIceCandidates: MobileCaptureIceCandidatePayload[];
	error?: string;
};

let server: https.Server | null = null;
let activeSession: MobileCaptureSession | null = null;

function createIdleState(): MobileCapturePairingState {
	return {
		status: "idle",
		sessionId: null,
		pairingUrl: null,
		qrSvg: null,
		expiresAt: null,
		lanAddress: null,
	};
}

function getLanAddress(): string {
	const interfaces = os.networkInterfaces();
	for (const entries of Object.values(interfaces)) {
		for (const entry of entries ?? []) {
			if (entry.family === "IPv4" && !entry.internal) {
				return entry.address;
			}
		}
	}
	return "127.0.0.1";
}

function createState(session: MobileCaptureSession | null): MobileCapturePairingState {
	if (!session) {
		return createIdleState();
	}

	const status = Date.now() > session.expiresAt ? "expired" : session.status;
	return {
		status,
		sessionId: session.id,
		pairingUrl: session.pairingUrl,
		qrSvg: session.qrSvg,
		expiresAt: session.expiresAt,
		lanAddress: session.lanAddress,
		error: session.error,
	};
}

function notifyPairingStateChanged() {
	const state = createState(activeSession);
	for (const window of BrowserWindow.getAllWindows()) {
		if (!window.isDestroyed()) {
			window.webContents.send("mobile-capture-state-changed", state);
		}
	}
}

function setSessionStatus(status: MobileCapturePairingState["status"], error?: string) {
	if (!activeSession) {
		return;
	}

	activeSession.status = status;
	activeSession.error = error;
	notifyPairingStateChanged();
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
	response.writeHead(statusCode, {
		"Content-Type": "application/json; charset=utf-8",
		"Cache-Control": "no-store",
	});
	response.end(JSON.stringify(payload));
}

function sendHtml(response: ServerResponse, statusCode: number, html: string) {
	response.writeHead(statusCode, {
		"Content-Type": "text/html; charset=utf-8",
		"Cache-Control": "no-store",
	});
	response.end(html);
}

function parseRequestUrl(request: IncomingMessage): URL {
	return new URL(request.url ?? "/", "https://screenmint.local");
}

function resolveSessionFromUrl(url: URL): MobileCaptureSession | null {
	const pathParts = url.pathname.split("/").filter(Boolean);
	const sessionId = pathParts[1];
	const token = url.searchParams.get("token") ?? "";
	if (
		!activeSession ||
		!sessionId ||
		activeSession.id !== sessionId ||
		activeSession.token !== token
	) {
		return null;
	}
	if (Date.now() > activeSession.expiresAt) {
		setSessionStatus("expired");
		return null;
	}
	return activeSession;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
	const chunks: Buffer[] = [];
	let byteLength = 0;

	for await (const chunk of request) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		byteLength += buffer.byteLength;
		if (byteLength > MAX_BODY_BYTES) {
			throw new Error("Request body is too large");
		}
		chunks.push(buffer);
	}

	if (chunks.length === 0) {
		return null;
	}

	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function isSignalPayload(value: unknown): value is MobileCaptureSignalPayload {
	if (!value || typeof value !== "object") {
		return false;
	}
	const candidate = value as Partial<MobileCaptureSignalPayload>;
	return (
		(candidate.type === "offer" || candidate.type === "answer") &&
		typeof candidate.sdp === "string" &&
		candidate.sdp.length > 0
	);
}

function isIceCandidatePayload(value: unknown): value is MobileCaptureIceCandidatePayload {
	if (!value || typeof value !== "object") {
		return false;
	}
	const candidate = value as Partial<MobileCaptureIceCandidatePayload>;
	return typeof candidate.candidate === "string" && candidate.candidate.length > 0;
}

function createMobileCapturePage(): string {
	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	<title>ScreenMint Mobile Camera</title>
	<style>
		:root { color-scheme: dark; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #09090b; color: white; }
		* { box-sizing: border-box; }
		body { margin: 0; min-height: 100svh; display: grid; grid-template-rows: 1fr auto; background: #09090b; }
		main { position: relative; min-height: 0; overflow: hidden; }
		video { width: 100%; height: 100%; min-height: 100svh; object-fit: cover; background: #111; transform: scaleX(-1); }
		.panel { position: fixed; left: 16px; right: 16px; bottom: max(16px, env(safe-area-inset-bottom)); display: grid; gap: 12px; }
		.status { padding: 12px 14px; border-radius: 16px; background: rgba(12, 12, 14, 0.74); border: 1px solid rgba(255,255,255,0.14); backdrop-filter: blur(18px); }
		.title { font-size: 15px; font-weight: 700; letter-spacing: 0; }
		.hint { margin-top: 4px; font-size: 12px; line-height: 1.4; color: rgba(255,255,255,0.68); }
		.controls { display: flex; gap: 10px; }
		button { flex: 1; height: 46px; border: 0; border-radius: 14px; color: white; font-weight: 700; background: rgba(255,255,255,0.14); }
		button.primary { background: #ef4444; }
		button:disabled { opacity: 0.45; }
	</style>
</head>
<body>
	<main><video id="preview" autoplay muted playsinline></video></main>
	<div class="panel">
		<div class="status">
			<div class="title" id="statusTitle">Connecting to ScreenMint</div>
			<div class="hint" id="statusHint">Allow camera and microphone access when prompted.</div>
		</div>
		<div class="controls">
			<button id="cameraBtn" disabled>Camera</button>
			<button id="micBtn" disabled>Mic</button>
			<button id="switchBtn" disabled>Switch</button>
			<button id="reconnectBtn" class="primary">Reconnect</button>
		</div>
	</div>
	<script>
		const token = new URLSearchParams(location.search).get("token") || "";
		const sessionId = location.pathname.split("/").filter(Boolean)[1] || "";
		const base = "/api/" + encodeURIComponent(sessionId) + "?token=" + encodeURIComponent(token);
		const preview = document.getElementById("preview");
		const statusTitle = document.getElementById("statusTitle");
		const statusHint = document.getElementById("statusHint");
		const cameraBtn = document.getElementById("cameraBtn");
		const micBtn = document.getElementById("micBtn");
		const switchBtn = document.getElementById("switchBtn");
		const reconnectBtn = document.getElementById("reconnectBtn");
		let pc;
		let stream;
		let facingMode = "user";
		let sentDesktopCandidateCount = 0;

		function setStatus(title, hint) {
			statusTitle.textContent = title;
			statusHint.textContent = hint;
		}

		async function api(action, options) {
			const response = await fetch(base + "&action=" + encodeURIComponent(action), {
				cache: "no-store",
				...options,
				headers: { "Content-Type": "application/json", ...(options && options.headers ? options.headers : {}) },
			});
			if (!response.ok) throw new Error(await response.text());
			return response.json();
		}

		async function getMedia() {
			if (stream) stream.getTracks().forEach((track) => track.stop());
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 60 } },
				audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
			});
			preview.srcObject = stream;
			cameraBtn.disabled = false;
			micBtn.disabled = false;
			switchBtn.disabled = false;
			cameraBtn.textContent = "Camera on";
			micBtn.textContent = "Mic on";
			return stream;
		}

		async function waitForOffer() {
			for (let index = 0; index < 120; index += 1) {
				const result = await api("offer");
				if (result.offer) return result.offer;
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
			throw new Error("Timed out waiting for ScreenMint.");
		}

		async function pollDesktopCandidates() {
			while (pc && pc.signalingState !== "closed") {
				try {
					const result = await fetch(base + "&action=desktop-candidates&after=" + sentDesktopCandidateCount, { cache: "no-store" }).then((response) => {
						if (!response.ok) throw new Error("Candidate sync failed");
						return response.json();
					});
					sentDesktopCandidateCount = result.nextIndex || sentDesktopCandidateCount;
					for (const candidate of result.candidates || []) {
						await pc.addIceCandidate(candidate);
					}
				} catch {
					return;
				}
				await new Promise((resolve) => setTimeout(resolve, 350));
			}
		}

		async function connect() {
			setStatus("Connecting to ScreenMint", "Allow camera and microphone access when prompted.");
			reconnectBtn.disabled = true;
			await api("phone-opened", { method: "POST", body: "{}" });
			const media = await getMedia();
			pc = new RTCPeerConnection({ iceServers: [] });
			pc.onicecandidate = (event) => {
				if (event.candidate) {
					void api("phone-candidate", { method: "POST", body: JSON.stringify(event.candidate.toJSON()) });
				}
			};
			pc.onconnectionstatechange = () => {
				if (pc.connectionState === "connected") setStatus("Connected", "Keep this page open while recording.");
				if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
					setStatus("Disconnected", "Tap reconnect when you are ready.");
					reconnectBtn.disabled = false;
				}
			};
			for (const track of media.getTracks()) pc.addTrack(track, media);
			const offer = await waitForOffer();
			await pc.setRemoteDescription(offer);
			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);
			await api("answer", { method: "POST", body: JSON.stringify(answer) });
			void pollDesktopCandidates();
			setStatus("Pairing", "Waiting for the local network connection.");
		}

		cameraBtn.onclick = () => {
			const track = stream && stream.getVideoTracks()[0];
			if (!track) return;
			track.enabled = !track.enabled;
			cameraBtn.textContent = track.enabled ? "Camera on" : "Camera off";
		};
		micBtn.onclick = () => {
			const track = stream && stream.getAudioTracks()[0];
			if (!track) return;
			track.enabled = !track.enabled;
			micBtn.textContent = track.enabled ? "Mic on" : "Mic off";
		};
		switchBtn.onclick = async () => {
			facingMode = facingMode === "user" ? "environment" : "user";
			const nextStream = await getMedia();
			const videoTrack = nextStream.getVideoTracks()[0];
			const sender = pc && pc.getSenders().find((item) => item.track && item.track.kind === "video");
			if (sender && videoTrack) await sender.replaceTrack(videoTrack);
		};
		reconnectBtn.onclick = () => {
			if (pc) pc.close();
			void connect().catch((error) => {
				setStatus("Could not connect", error instanceof Error ? error.message : "Try scanning the QR code again.");
				reconnectBtn.disabled = false;
			});
		};
		void connect().catch((error) => {
			setStatus("Could not connect", error instanceof Error ? error.message : "Try scanning the QR code again.");
			reconnectBtn.disabled = false;
		});
	</script>
</body>
</html>`;
}

async function ensureServer(): Promise<https.Server> {
	if (server) {
		return server;
	}

	const cert = await selfsigned.generate(
		[{ name: "commonName", value: "ScreenMint Mobile Capture" }],
		{
			notAfterDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
			keySize: 2048,
			algorithm: "sha256",
		},
	);
	server = https.createServer({ key: cert.private, cert: cert.cert }, async (request, response) => {
		try {
			const url = parseRequestUrl(request);
			if (url.pathname.startsWith(MOBILE_PAGE_PATH_PREFIX)) {
				const session = resolveSessionFromUrl(url);
				if (!session) {
					sendHtml(response, 403, "<h1>ScreenMint pairing link expired</h1>");
					return;
				}
				sendHtml(response, 200, createMobileCapturePage());
				return;
			}

			if (!url.pathname.startsWith("/api/")) {
				sendJson(response, 404, { error: "Not found" });
				return;
			}

			const session = resolveSessionFromUrl(url);
			if (!session) {
				sendJson(response, 403, { error: "Invalid or expired pairing token" });
				return;
			}

			const action = url.searchParams.get("action");
			if (request.method === "POST" && action === "phone-opened") {
				setSessionStatus("phone-opened");
				sendJson(response, 200, { success: true });
				return;
			}

			if (request.method === "GET" && action === "offer") {
				sendJson(response, 200, { offer: session.desktopOffer });
				return;
			}

			if (request.method === "POST" && action === "answer") {
				const body = await readJsonBody(request);
				if (!isSignalPayload(body) || body.type !== "answer") {
					sendJson(response, 400, { error: "Invalid answer" });
					return;
				}
				session.phoneAnswer = body;
				setSessionStatus("connected");
				sendJson(response, 200, { success: true });
				return;
			}

			if (request.method === "POST" && action === "phone-candidate") {
				const body = await readJsonBody(request);
				if (!isIceCandidatePayload(body)) {
					sendJson(response, 400, { error: "Invalid ICE candidate" });
					return;
				}
				session.phoneIceCandidates.push(body);
				sendJson(response, 200, { success: true });
				return;
			}

			if (request.method === "GET" && action?.startsWith("desktop-candidates")) {
				const after = Number(url.searchParams.get("after") ?? "0");
				const startIndex = Number.isFinite(after) ? Math.max(0, after) : 0;
				sendJson(response, 200, {
					candidates: session.desktopIceCandidates.slice(startIndex),
					nextIndex: session.desktopIceCandidates.length,
				});
				return;
			}

			sendJson(response, 404, { error: "Unknown mobile capture action" });
		} catch (error) {
			setSessionStatus("error", error instanceof Error ? error.message : String(error));
			sendJson(response, 500, { error: "Mobile capture server error" });
		}
	});

	await new Promise<void>((resolve, reject) => {
		server?.once("error", reject);
		server?.listen(0, "0.0.0.0", () => {
			server?.off("error", reject);
			resolve();
		});
	});

	return server;
}

function getServerPort(activeServer: https.Server): number {
	const address = activeServer.address() as AddressInfo | null;
	if (!address) {
		throw new Error("Mobile capture server is not listening");
	}
	return address.port;
}

function stopServer() {
	const activeServer = server;
	server = null;
	if (activeServer) {
		activeServer.close();
	}
}

function successState() {
	return { success: true as const, state: createState(activeSession) };
}

function failure(error: unknown): IpcFailureResult {
	return {
		success: false,
		error: error instanceof Error ? error.message : String(error),
	};
}

export function registerMobileCaptureIpcHandlers() {
	ipcMain.handle(IPC_CHANNELS.mobileCapture.startPairing, async () => {
		try {
			stopServer();
			const activeServer = await ensureServer();
			const lanAddress = getLanAddress();
			const port = getServerPort(activeServer);
			const id = crypto.randomUUID();
			const token = crypto.randomBytes(18).toString("base64url");
			const pairingUrl = `https://${lanAddress}:${port}/mobile-capture/${id}?token=${token}`;
			activeSession = {
				id,
				token,
				expiresAt: Date.now() + PAIRING_TTL_MS,
				status: "pairing",
				pairingUrl,
				qrSvg: await QRCode.toString(pairingUrl, {
					type: "svg",
					errorCorrectionLevel: "M",
					margin: 1,
					color: { dark: "#111111", light: "#ffffff" },
				}),
				lanAddress,
				desktopOffer: null,
				phoneAnswer: null,
				desktopIceCandidates: [],
				phoneIceCandidates: [],
			};
			notifyPairingStateChanged();
			return successState();
		} catch (error) {
			return failure(error);
		}
	});

	ipcMain.handle(IPC_CHANNELS.mobileCapture.stopPairing, () => {
		activeSession = null;
		stopServer();
		notifyPairingStateChanged();
		return successState();
	});

	ipcMain.handle(IPC_CHANNELS.mobileCapture.getPairingState, () => successState());

	ipcMain.handle(
		IPC_CHANNELS.mobileCapture.setDesktopOffer,
		(_, sessionId: string, offer: MobileCaptureSignalPayload) => {
			if (!activeSession || activeSession.id !== sessionId || !isSignalPayload(offer)) {
				return { success: false, error: "Invalid mobile capture session" };
			}
			activeSession.desktopOffer = offer;
			return { success: true };
		},
	);

	ipcMain.handle(
		IPC_CHANNELS.mobileCapture.addDesktopIceCandidate,
		(_, sessionId: string, candidate: MobileCaptureIceCandidatePayload) => {
			if (!activeSession || activeSession.id !== sessionId || !isIceCandidatePayload(candidate)) {
				return { success: false, error: "Invalid mobile capture session" };
			}
			activeSession.desktopIceCandidates.push(candidate);
			return { success: true };
		},
	);

	ipcMain.handle(IPC_CHANNELS.mobileCapture.getPhoneAnswer, (_, sessionId: string) => {
		if (!activeSession || activeSession.id !== sessionId) {
			return { success: false, error: "Invalid mobile capture session" };
		}
		return { success: true, answer: activeSession.phoneAnswer };
	});

	ipcMain.handle(
		IPC_CHANNELS.mobileCapture.getPhoneIceCandidates,
		(_, sessionId: string, after: number) => {
			if (!activeSession || activeSession.id !== sessionId) {
				return { success: false, error: "Invalid mobile capture session" };
			}
			const startIndex = Number.isFinite(after) ? Math.max(0, after) : 0;
			return {
				success: true,
				candidates: activeSession.phoneIceCandidates.slice(startIndex),
				nextIndex: activeSession.phoneIceCandidates.length,
			};
		},
	);
}
