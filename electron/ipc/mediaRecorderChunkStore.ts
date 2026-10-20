import { randomUUID } from "node:crypto";
import { createWriteStream, type WriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

type ChunkSession = {
	id: string;
	path: string;
	stream: WriteStream;
	pending: Promise<void>;
	bytesWritten: number;
	closed: boolean;
};

export class MediaRecorderChunkStore {
	private readonly sessions = new Map<string, ChunkSession>();

	constructor(private readonly getDirectory: () => Promise<string>) {}

	async start(fileName: string) {
		const directory = await this.getDirectory();
		await fs.mkdir(directory, { recursive: true });

		const id = randomUUID();
		const safeFileName = path.basename(fileName);
		const filePath = path.join(directory, safeFileName);
		const stream = createWriteStream(filePath, { flags: "w" });
		const session: ChunkSession = {
			id,
			path: filePath,
			stream,
			pending: Promise.resolve(),
			bytesWritten: 0,
			closed: false,
		};

		this.sessions.set(id, session);
		return { id, path: filePath };
	}

	async append(id: string, chunk: ArrayBuffer | Uint8Array) {
		const session = this.getOpenSession(id);
		const buffer = Buffer.from(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
		if (buffer.byteLength === 0) {
			return { success: true, bytesWritten: session.bytesWritten };
		}

		session.pending = session.pending.then(
			() =>
				new Promise<void>((resolve, reject) => {
					const onError = (error: Error) => {
						cleanup();
						reject(error);
					};
					const onDrain = () => {
						cleanup();
						session.bytesWritten += buffer.byteLength;
						resolve();
					};
					const cleanup = () => {
						session.stream.off("error", onError);
						session.stream.off("drain", onDrain);
					};

					session.stream.once("error", onError);
					const flushed = session.stream.write(buffer);

					if (!flushed) {
						session.stream.once("drain", onDrain);
						return;
					}

					cleanup();
					session.bytesWritten += buffer.byteLength;
					resolve();
				}),
		);

		await session.pending;
		return { success: true, bytesWritten: session.bytesWritten };
	}

	async finish(id: string) {
		const session = this.getOpenSession(id);
		session.closed = true;
		await session.pending;
		await new Promise<void>((resolve, reject) => {
			session.stream.end((error?: Error | null) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
		this.sessions.delete(id);
		return { path: session.path, bytesWritten: session.bytesWritten };
	}

	async discard(id: string) {
		const session = this.sessions.get(id);
		if (!session) {
			return;
		}

		session.closed = true;
		this.sessions.delete(id);
		await session.pending.catch(() => undefined);
		// The stream opens its file asynchronously; wait for it to fully close before deleting,
		// otherwise a late open can recreate the file after it was removed.
		await new Promise<void>((resolve) => {
			if (session.stream.closed) {
				resolve();
				return;
			}
			session.stream.once("close", () => resolve());
			session.stream.destroy();
		});
		await fs.rm(session.path, { force: true }).catch(() => undefined);
	}

	private getOpenSession(id: string) {
		const session = this.sessions.get(id);
		if (!session || session.closed) {
			throw new Error("MediaRecorder chunk session is not available.");
		}
		return session;
	}
}
