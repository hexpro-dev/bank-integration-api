import WebSocket from "ws";
import type { ObserverConfig } from "../config.js";
import type { ObserverOutMessage, ApiInMessage } from "../types.js";

export class StreamClient {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 50;
	private onMessageHandler: ((msg: ApiInMessage) => void) | null = null;
	private config: ObserverConfig;

	constructor(config: ObserverConfig) {
		this.config = config;
	}

	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			const url = `${this.config.apiWsUrl}/internal/observer/stream?observerId=${this.config.observerId}`;

			this.ws = new WebSocket(url, {
				headers: {
					Authorization: `Internal ${this.config.internalApiKey}`,
				},
			});

			this.ws.on("open", () => {
				this.reconnectAttempts = 0;
				console.log("[StreamClient] Connected to API stream");
				resolve();
			});

			this.ws.on("message", (data) => {
				try {
					const msg = JSON.parse(data.toString()) as ApiInMessage;
					this.onMessageHandler?.(msg);
				} catch (err) {
					console.error("[StreamClient] Failed to parse message:", err);
				}
			});

			this.ws.on("close", (code, reason) => {
				console.log(
					`[StreamClient] Connection closed: ${code} ${reason.toString()}`,
				);
				this.ws = null;
				this.reconnect();
			});

			this.ws.on("error", (err) => {
				console.error("[StreamClient] WebSocket error:", err.message);
				if (this.reconnectAttempts === 0) {
					reject(err);
				}
			});
		});
	}

	async send(message: ObserverOutMessage): Promise<void> {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			throw new Error("[StreamClient] WebSocket is not connected");
		}
		this.ws.send(JSON.stringify(message));
	}

	onMessageReceived(handler: (msg: ApiInMessage) => void): void {
		this.onMessageHandler = handler;
	}

	private reconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error(
				`[StreamClient] Max reconnect attempts (${this.maxReconnectAttempts}) reached, giving up`,
			);
			return;
		}

		const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
		this.reconnectAttempts++;

		console.log(
			`[StreamClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
		);

		setTimeout(() => {
			this.connect().catch((err) => {
				console.error("[StreamClient] Reconnection failed:", err.message);
			});
		}, delay);
	}

	close(): void {
		if (this.ws) {
			this.ws.removeAllListeners();
			this.ws.close();
			this.ws = null;
		}
	}
}
