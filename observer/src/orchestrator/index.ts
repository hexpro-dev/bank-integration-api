import type { ObserverConfig } from "../config.js";
import type { ApiInMessage, SeatCredentials, Bank } from "../types.js";
import { StreamClient } from "../api/stream-client.js";
import { SeatManager } from "./seat-manager.js";

export class Orchestrator {
	private stream: StreamClient;
	private seatManagers = new Map<string, SeatManager>();
	private config: ObserverConfig;
	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

	constructor(config: ObserverConfig) {
		this.config = config;
		this.stream = new StreamClient(config);
	}

	async start(): Promise<void> {
		console.log("[Orchestrator] Connecting to API stream...");

		this.stream.onMessageReceived((msg) => this.handleMessage(msg));
		await this.stream.connect();

		this.heartbeatInterval = setInterval(async () => {
			try {
				await this.stream.send({
					type: "heartbeat",
					timestamp: new Date().toISOString(),
					activeSeatsCount: this.seatManagers.size,
				});
			} catch (err) {
				console.error("[Orchestrator] Heartbeat send failed:", err);
			}
		}, 60_000);

		console.log("[Orchestrator] Waiting for active_seats message...");
	}

	handleMessage(msg: ApiInMessage): void {
		switch (msg.type) {
			case "active_seats":
				console.log(
					`[Orchestrator] Received ${msg.seats.length} active seat(s)`,
				);
				for (const seat of msg.seats) {
					if (seat.isActive && !this.seatManagers.has(seat.id)) {
						this.startSeatManager(seat);
					}
				}
				break;

			case "2fa_code": {
				const manager = this.seatManagers.get(msg.seatId);
				if (manager) {
					manager.receiveTwoFactorCode(msg.code);
				} else {
					console.warn(
						`[Orchestrator] 2FA code for unknown seat: ${msg.seatId}`,
					);
				}
				break;
			}

			case "refresh_request": {
				const manager = this.seatManagers.get(msg.seatId);
				if (manager) {
					manager.receiveRefreshRequest(msg.accountId);
				} else {
					console.warn(
						`[Orchestrator] Refresh request for unknown seat: ${msg.seatId}`,
					);
				}
				break;
			}

			case "seat_added":
				console.log(`[Orchestrator] Seat added: ${msg.seat.id}`);
				if (!this.seatManagers.has(msg.seat.id)) {
					this.startSeatManager({
						id: msg.seat.id,
						bank: msg.seat.bank as Bank,
						username: msg.seat.username,
						password: msg.seat.password,
						isActive: msg.seat.isActive,
					});
				}
				break;

			case "seat_updated": {
				console.log(`[Orchestrator] Seat updated: ${msg.seat.id}`);
				const existing = this.seatManagers.get(msg.seat.id);
				if (existing) {
					existing.updateCredentials({
						id: msg.seat.id,
						bank: msg.seat.bank as Bank,
						username: msg.seat.username,
						password: msg.seat.password,
						isActive: msg.seat.isActive,
					});

					// Restart the seat to apply credential changes
					existing.stop().then(() => {
						if (msg.seat.isActive) {
							this.startSeatManager({
								id: msg.seat.id,
								bank: msg.seat.bank as Bank,
								username: msg.seat.username,
								password: msg.seat.password,
								isActive: msg.seat.isActive,
							});
						}
					});
				}
				break;
			}

			case "seat_deleted": {
				console.log(`[Orchestrator] Seat deleted: ${msg.seatId}`);
				const toDelete = this.seatManagers.get(msg.seatId);
				if (toDelete) {
					toDelete.stop();
					this.seatManagers.delete(msg.seatId);
				}
				break;
			}

			case "seat_2fa_updated":
				console.log(
					`[Orchestrator] 2FA config updated for seat: ${msg.seatId}`,
				);
				break;
		}
	}

	async startSeatManager(seat: SeatCredentials): Promise<void> {
		console.log(`[Orchestrator] Starting seat manager for ${seat.id} (${seat.bank})`);
		const manager = new SeatManager(seat, this.stream, this.config);
		this.seatManagers.set(seat.id, manager);
		manager.start().catch((err) => {
			console.error(
				`[Orchestrator] Seat ${seat.id} failed to start:`,
				err,
			);
		});
	}

	async stopAll(): Promise<void> {
		console.log("[Orchestrator] Stopping all seat managers...");

		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}

		const stops = Array.from(this.seatManagers.values()).map((m) =>
			m.stop().catch((err) => {
				console.error("[Orchestrator] Error stopping seat:", err);
			}),
		);
		await Promise.all(stops);
		this.seatManagers.clear();

		this.stream.close();
		console.log("[Orchestrator] Shutdown complete");
	}
}
