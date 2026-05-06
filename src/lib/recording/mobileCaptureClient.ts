import type {
	MobileCaptureIceCandidatePayload,
	MobileCapturePairingState,
	MobileCaptureSignalPayload,
} from "@/electron-ipc/contracts";

const ANSWER_POLL_INTERVAL_MS = 350;
const ICE_POLL_INTERVAL_MS = 350;
const STREAM_TIMEOUT_MS = 120_000;

type MobileCaptureClientEvents = {
	onState?: (state: MobileCapturePairingState) => void;
	onDisconnect?: () => void;
};

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function serializeDescription(description: RTCSessionDescriptionInit): MobileCaptureSignalPayload {
	if (!description.type || !description.sdp) {
		throw new Error("Unable to create mobile capture offer.");
	}
	return { type: description.type, sdp: description.sdp };
}

function serializeCandidate(candidate: RTCIceCandidate): MobileCaptureIceCandidatePayload {
	return {
		candidate: candidate.candidate,
		sdpMid: candidate.sdpMid,
		sdpMLineIndex: candidate.sdpMLineIndex,
		usernameFragment: candidate.usernameFragment,
	};
}

export class MobileCaptureClient {
	private pc: RTCPeerConnection | null = null;
	private stream: MediaStream | null = null;
	private sessionId: string | null = null;
	private stopped = false;
	private phoneCandidateIndex = 0;
	private streamPromise: Promise<MediaStream> | null = null;
	private removeStateListener: (() => void) | null = null;

	constructor(private readonly events: MobileCaptureClientEvents = {}) {}

	async startPairing(): Promise<MobileCapturePairingState> {
		this.stop(false);
		this.stopped = false;
		this.phoneCandidateIndex = 0;

		const result = await window.electronAPI.startMobileCapturePairing();
		if (!result.success) {
			throw new Error(result.error ?? "Failed to start mobile camera pairing.");
		}

		const { state } = result;
		if (!state.sessionId) {
			throw new Error("Mobile camera pairing did not create a session.");
		}

		this.sessionId = state.sessionId;
		this.events.onState?.(state);
		this.removeStateListener = window.electronAPI.onMobileCapturePairingStateChanged((next) => {
			this.events.onState?.(next);
		});

		await this.createDesktopPeer(state.sessionId);
		return state;
	}

	waitForStream(): Promise<MediaStream> {
		if (this.stream) {
			return Promise.resolve(this.stream);
		}
		if (!this.streamPromise) {
			this.streamPromise = new Promise<MediaStream>((_resolve, reject) => {
				window.setTimeout(() => {
					if (!this.stream && !this.stopped) {
						reject(new Error("Timed out waiting for the phone camera."));
					}
				}, STREAM_TIMEOUT_MS);
			});
		}
		return this.streamPromise;
	}

	getStream(): MediaStream | null {
		return this.stream;
	}

	stop(stopPairing = true) {
		this.stopped = true;
		this.removeStateListener?.();
		this.removeStateListener = null;
		if (this.pc) {
			this.pc.ontrack = null;
			this.pc.onicecandidate = null;
			this.pc.onconnectionstatechange = null;
			this.pc.close();
			this.pc = null;
		}
		if (this.stream) {
			this.stream.getTracks().forEach((track) => track.stop());
			this.stream = null;
		}
		this.sessionId = null;
		this.streamPromise = null;
		if (stopPairing) {
			void window.electronAPI.stopMobileCapturePairing();
		}
	}

	private async createDesktopPeer(sessionId: string) {
		const pc = new RTCPeerConnection({ iceServers: [] });
		const remoteStream = new MediaStream();
		let resolveStream: ((stream: MediaStream) => void) | null = null;
		let rejectStream: ((error: Error) => void) | null = null;
		this.streamPromise = new Promise<MediaStream>((resolve, reject) => {
			resolveStream = resolve;
			rejectStream = reject;
			window.setTimeout(() => {
				if (!this.stream && !this.stopped) {
					reject(new Error("Timed out waiting for the phone camera."));
				}
			}, STREAM_TIMEOUT_MS);
		});
		this.pc = pc;

		pc.addTransceiver("video", { direction: "recvonly" });
		pc.addTransceiver("audio", { direction: "recvonly" });

		pc.ontrack = (event) => {
			const [track] = event.streams[0]
				?.getTracks()
				.filter((candidate) => candidate === event.track) ?? [event.track];
			if (!track) {
				return;
			}

			remoteStream.addTrack(track);
			if (remoteStream.getVideoTracks().length > 0 && !this.stream) {
				this.stream = remoteStream;
				resolveStream?.(remoteStream);
			}
		};

		pc.onicecandidate = (event) => {
			if (!event.candidate || !this.sessionId) {
				return;
			}
			void window.electronAPI.addMobileCaptureDesktopIceCandidate(
				this.sessionId,
				serializeCandidate(event.candidate),
			);
		};

		pc.onconnectionstatechange = () => {
			if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
				this.events.onDisconnect?.();
			}
		};

		const offer = await pc.createOffer();
		await pc.setLocalDescription(offer);
		const offerResult = await window.electronAPI.setMobileCaptureDesktopOffer(
			sessionId,
			serializeDescription(offer),
		);
		if (!offerResult.success) {
			throw new Error(offerResult.error ?? "Failed to publish mobile capture offer.");
		}

		void this.pollPhoneCandidates();
		void this.waitForAnswer(sessionId).catch((error) => {
			rejectStream?.(error instanceof Error ? error : new Error(String(error)));
		});
	}

	private async waitForAnswer(sessionId: string) {
		while (!this.stopped && this.pc && this.pc.signalingState !== "closed") {
			const result = await window.electronAPI.getMobileCapturePhoneAnswer(sessionId);
			if (!result.success) {
				throw new Error(result.error ?? "Failed to read mobile capture answer.");
			}
			if (result.answer) {
				await this.pc.setRemoteDescription(result.answer);
				return;
			}
			await delay(ANSWER_POLL_INTERVAL_MS);
		}
	}

	private async pollPhoneCandidates() {
		while (!this.stopped && this.pc && this.sessionId && this.pc.signalingState !== "closed") {
			const result = await window.electronAPI.getMobileCapturePhoneIceCandidates(
				this.sessionId,
				this.phoneCandidateIndex,
			);
			if (result.success) {
				this.phoneCandidateIndex = result.nextIndex ?? this.phoneCandidateIndex;
				for (const candidate of result.candidates ?? []) {
					await this.pc.addIceCandidate(candidate);
				}
			}
			await delay(ICE_POLL_INTERVAL_MS);
		}
	}
}
