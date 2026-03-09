import { StreamInOut } from "encore.dev/api";
import type { ObserverInMessage, ApiOutMessage } from "./stream.js";
import log from "encore.dev/log";

type ObserverStream = StreamInOut<ObserverInMessage, ApiOutMessage>;

const activeStreams = new Map<string, ObserverStream>();

export function registerStream(
	observerId: string,
	stream: ObserverStream,
): void {
	activeStreams.set(observerId, stream);
	log.info("observer connected", { observerId });
}

export function unregisterStream(observerId: string): void {
	activeStreams.delete(observerId);
	log.info("observer disconnected", { observerId });
}

export async function sendRefreshRequest(
	seatId: string,
	accountId: string,
): Promise<boolean> {
	for (const [, stream] of activeStreams) {
		try {
			await stream.send({ type: "refresh_request", seatId, accountId });
			return true;
		} catch {
			/* stream may be dead */
		}
	}
	return false;
}

export async function send2FACode(
	seatId: string,
	code: string,
): Promise<boolean> {
	for (const [, stream] of activeStreams) {
		try {
			await stream.send({ type: "2fa_code", seatId, code });
			return true;
		} catch {
			/* stream may be dead */
		}
	}
	return false;
}

export async function sendSeatUpdate(seat: {
	id: string;
	bank: string;
	username: string;
	password: string;
	isActive: boolean;
}): Promise<void> {
	for (const [, stream] of activeStreams) {
		try {
			await stream.send({ type: "seat_updated", seat });
		} catch {
			/* stream may be dead */
		}
	}
}

export async function sendSeatDeleted(seatId: string): Promise<void> {
	for (const [, stream] of activeStreams) {
		try {
			await stream.send({ type: "seat_deleted", seatId });
		} catch {
			/* stream may be dead */
		}
	}
}

export async function sendSeatAdded(seat: {
	id: string;
	bank: string;
	username: string;
	password: string;
	isActive: boolean;
}): Promise<void> {
	for (const [, stream] of activeStreams) {
		try {
			await stream.send({ type: "seat_added", seat });
		} catch {
			/* stream may be dead */
		}
	}
}

export async function sendSeat2faUpdate(
	seatId: string,
	config: {
		method: string;
		smsProvider?: string;
		smsPhoneNumber?: string;
	} | null,
): Promise<void> {
	for (const [, stream] of activeStreams) {
		try {
			await stream.send({ type: "seat_2fa_updated", seatId, config });
		} catch {
			/* stream may be dead */
		}
	}
}
