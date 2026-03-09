import { api, APIError } from "encore.dev/api";
import { eq, and } from "drizzle-orm";
import log from "encore.dev/log";
import { secret } from "encore.dev/config";
import { registerStream, unregisterStream } from "./connections.js";
import { storeScreenshot } from "./screenshots.js";
import { orm } from "../lib/db.js";

const EncryptionKey = secret("EncryptionKey");
import {
	seats,
	seat2faConfigs,
	seatAccountScopes,
	accounts,
	balances,
	transactions,
	observerSessions,
} from "@hex-pro/bank-integration-database/schema";
import { decrypt } from "../lib/crypto.js";
import { dispatchWebhooks } from "../lib/webhook-dispatch.js";
import { send2FANotification } from "../lib/notifications.js";

// --- Handshake ---

export interface ObserverHandshake {
	observerId: string;
}

// --- Observer -> API messages ---

interface SessionUpdateMsg {
	type: "session_update";
	seatId: string;
	status:
		| "logging_in"
		| "2fa_pending"
		| "active"
		| "error"
		| "expired"
		| "logged_out";
	errorMessage?: string;
}

interface BalanceUpdateMsg {
	type: "balance_update";
	accountId: string;
	available: string;
	current: string;
	recordedAt: string;
}

interface TransactionsUpdateMsg {
	type: "transactions_update";
	accountId: string;
	transactions: Array<{
		transactionDate: string;
		description: string;
		amount: string;
		balance?: string;
		category?: string;
		reference?: string;
		transactionType: "debit" | "credit";
		externalId?: string;
	}>;
}

interface AccountsDiscoveredMsg {
	type: "accounts_discovered";
	seatId: string;
	accounts: Array<{
		accountName: string;
		accountNumber: string;
		bsb?: string;
		accountType?: string;
	}>;
}

interface HeartbeatMsg {
	type: "heartbeat";
	timestamp: string;
	activeSeatsCount: number;
}

interface ScreenshotMsg {
	type: "screenshot";
	seatId: string;
	imageBase64: string;
}

export interface ObserverInMessage {
	type:
		| "session_update"
		| "balance_update"
		| "transactions_update"
		| "accounts_discovered"
		| "heartbeat"
		| "screenshot";
	seatId?: string;
	status?:
		| "logging_in"
		| "2fa_pending"
		| "active"
		| "error"
		| "expired"
		| "logged_out";
	errorMessage?: string;
	accountId?: string;
	available?: string;
	current?: string;
	recordedAt?: string;
	transactions?: Array<{
		transactionDate: string;
		description: string;
		amount: string;
		balance?: string;
		category?: string;
		reference?: string;
		transactionType: "debit" | "credit";
		externalId?: string;
	}>;
	accounts?: Array<{
		accountName: string;
		accountNumber: string;
		bsb?: string;
		accountType?: string;
	}>;
	timestamp?: string;
	activeSeatsCount?: number;
	imageBase64?: string;
}

// --- API -> Observer messages ---

interface ActiveSeatsMsg {
	type: "active_seats";
	seats: Array<{
		id: string;
		bank: string;
		username: string;
		password: string;
		isActive: boolean;
		twoFactorConfig?: {
			method: string;
			smsProvider?: string;
			smsPhoneNumber?: string;
			notificationEmail?: string;
		} | null;
		accountScopes?: Array<{
			identifier: string;
			identifierType: string;
		}>;
	}>;
}

interface TwoFactorCodeMsg {
	type: "2fa_code";
	seatId: string;
	code: string;
}

interface RefreshRequestMsg {
	type: "refresh_request";
	seatId: string;
	accountId: string;
}

interface SeatUpdatedMsg {
	type: "seat_updated";
	seat: {
		id: string;
		bank: string;
		username: string;
		password: string;
		isActive: boolean;
	};
}

interface SeatDeletedMsg {
	type: "seat_deleted";
	seatId: string;
}

interface SeatAddedMsg {
	type: "seat_added";
	seat: {
		id: string;
		bank: string;
		username: string;
		password: string;
		isActive: boolean;
	};
}

interface Seat2faUpdatedMsg {
	type: "seat_2fa_updated";
	seatId: string;
	config: {
		method: string;
		smsProvider?: string;
		smsPhoneNumber?: string;
	} | null;
}

export interface ApiOutMessage {
	type:
		| "active_seats"
		| "2fa_code"
		| "refresh_request"
		| "seat_updated"
		| "seat_deleted"
		| "seat_added"
		| "seat_2fa_updated";
	seats?: Array<{
		id: string;
		bank: string;
		username: string;
		password: string;
		isActive: boolean;
		twoFactorConfig?: {
			method: string;
			smsProvider?: string;
			smsPhoneNumber?: string;
			notificationEmail?: string;
		} | null;
		accountScopes?: Array<{
			identifier: string;
			identifierType: string;
		}>;
	}>;
	seatId?: string;
	code?: string;
	accountId?: string;
	seat?: {
		id: string;
		bank: string;
		username: string;
		password: string;
		isActive: boolean;
	};
	config?: {
		method: string;
		smsProvider?: string;
		smsPhoneNumber?: string;
	} | null;
}

// --- Helpers ---

async function getActiveSeatsPayload(): Promise<ActiveSeatsMsg> {
	const seatRows = await orm
		.select()
		.from(seats)
		.where(eq(seats.isActive, true));

	const seatPayloads: ActiveSeatsMsg["seats"] = [];

	for (const seat of seatRows) {
		const [tfaConfig] = await orm
			.select()
			.from(seat2faConfigs)
			.where(eq(seat2faConfigs.seatId, seat.id))
			.limit(1);

		const scopeRows = await orm
			.select({
				identifier: seatAccountScopes.identifier,
				identifierType: seatAccountScopes.identifierType,
			})
			.from(seatAccountScopes)
			.where(eq(seatAccountScopes.seatId, seat.id));

		seatPayloads.push({
			id: seat.id,
			bank: seat.bank,
			username: decrypt(seat.encryptedUsername, EncryptionKey()),
			password: decrypt(seat.encryptedPassword, EncryptionKey()),
			isActive: seat.isActive,
			twoFactorConfig: tfaConfig
				? {
						method: tfaConfig.method,
						smsProvider: tfaConfig.smsProvider ?? undefined,
						smsPhoneNumber: tfaConfig.smsPhoneNumber ?? undefined,
						notificationEmail: tfaConfig.notificationEmail ?? undefined,
					}
				: null,
			accountScopes: scopeRows.length > 0 ? scopeRows : undefined,
		});
	}

	return { type: "active_seats", seats: seatPayloads };
}

async function getUserIdForAccount(accountId: string): Promise<string | null> {
	const [account] = await orm
		.select({ seatId: accounts.seatId })
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);

	if (!account) return null;

	const [seat] = await orm
		.select({ userId: seats.userId })
		.from(seats)
		.where(eq(seats.id, account.seatId))
		.limit(1);

	return seat?.userId ?? null;
}

async function getUserIdForSeat(seatId: string): Promise<string | null> {
	const [seat] = await orm
		.select({ userId: seats.userId })
		.from(seats)
		.where(eq(seats.id, seatId))
		.limit(1);

	return seat?.userId ?? null;
}

// --- Message handlers ---

async function handleSessionUpdate(msg: SessionUpdateMsg): Promise<void> {
	const now = new Date();

	const [existing] = await orm
		.select({ id: observerSessions.id })
		.from(observerSessions)
		.where(eq(observerSessions.seatId, msg.seatId))
		.limit(1);

	if (existing) {
		await orm
			.update(observerSessions)
			.set({
				status: msg.status,
				errorMessage: msg.errorMessage ?? null,
				lastActivityAt: now,
				updatedAt: now,
			})
			.where(eq(observerSessions.id, existing.id));
	} else {
		await orm.insert(observerSessions).values({
			seatId: msg.seatId,
			status: msg.status,
			errorMessage: msg.errorMessage ?? null,
			startedAt: now,
			lastActivityAt: now,
		});
	}

	log.info("session updated", {
		seatId: msg.seatId,
		status: msg.status,
	});
}

async function handleBalanceUpdate(msg: BalanceUpdateMsg): Promise<void> {
	await orm.insert(balances).values({
		accountId: msg.accountId,
		available: msg.available,
		current: msg.current,
		recordedAt: new Date(msg.recordedAt),
	});

	const userId = await getUserIdForAccount(msg.accountId);
	if (userId) {
		await dispatchWebhooks(userId, "balance_updated", {
			accountId: msg.accountId,
			available: msg.available,
			current: msg.current,
			recordedAt: msg.recordedAt,
		});
	}

	log.info("balance updated", { accountId: msg.accountId });
}

async function handleTransactionsUpdate(
	msg: TransactionsUpdateMsg,
): Promise<void> {
	for (const tx of msg.transactions) {
		if (tx.externalId) {
			const [existing] = await orm
				.select({ id: transactions.id })
				.from(transactions)
				.where(eq(transactions.externalId, tx.externalId))
				.limit(1);

			if (existing) {
				await orm
					.update(transactions)
					.set({
						transactionDate: tx.transactionDate,
						description: tx.description,
						amount: tx.amount,
						balance: tx.balance ?? null,
						category: tx.category ?? null,
						reference: tx.reference ?? null,
						transactionType: tx.transactionType,
					})
					.where(eq(transactions.id, existing.id));
				continue;
			}
		}

		await orm.insert(transactions).values({
			accountId: msg.accountId,
			transactionDate: tx.transactionDate,
			description: tx.description,
			amount: tx.amount,
			balance: tx.balance ?? null,
			category: tx.category ?? null,
			reference: tx.reference ?? null,
			transactionType: tx.transactionType,
			externalId: tx.externalId ?? null,
		});
	}

	const userId = await getUserIdForAccount(msg.accountId);
	if (userId) {
		await dispatchWebhooks(userId, "transactions_updated", {
			accountId: msg.accountId,
			count: msg.transactions.length,
		});
	}

	log.info("transactions updated", {
		accountId: msg.accountId,
		count: msg.transactions.length,
	});
}

async function handleAccountsDiscovered(
	msg: AccountsDiscoveredMsg,
): Promise<void> {
	for (const acct of msg.accounts) {
		const [existing] = await orm
			.select({ id: accounts.id })
			.from(accounts)
			.where(
				and(
					eq(accounts.accountNumber, acct.accountNumber),
					eq(accounts.seatId, msg.seatId),
				),
			)
			.limit(1);

		if (!existing) {
			await orm.insert(accounts).values({
				seatId: msg.seatId,
				accountName: acct.accountName,
				accountNumber: acct.accountNumber,
				bsb: acct.bsb ?? null,
				accountType: acct.accountType ?? null,
			});
		}
	}

	log.info("accounts discovered", {
		seatId: msg.seatId,
		count: msg.accounts.length,
	});
}

async function handleScreenshot(msg: ScreenshotMsg): Promise<void> {
	const token = storeScreenshot(msg.imageBase64);
	const screenshotUrl = `/screenshots/${token}`;

	const [session] = await orm
		.select({ id: observerSessions.id })
		.from(observerSessions)
		.where(eq(observerSessions.seatId, msg.seatId))
		.limit(1);

	if (session) {
		await orm
			.update(observerSessions)
			.set({
				screenshotUrl,
				lastActivityAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(observerSessions.id, session.id));
	}

	const [tfaConfig] = await orm
		.select()
		.from(seat2faConfigs)
		.where(
			and(
				eq(seat2faConfigs.seatId, msg.seatId),
				eq(seat2faConfigs.method, "app"),
			),
		)
		.limit(1);

	if (tfaConfig?.notificationEmail) {
		const [seat] = await orm
			.select({ bank: seats.bank })
			.from(seats)
			.where(eq(seats.id, msg.seatId))
			.limit(1);

		await send2FANotification(
			tfaConfig.notificationEmail,
			seat?.bank ?? "unknown",
			screenshotUrl,
		);
	}

	log.info("screenshot stored", { seatId: msg.seatId, token });
}

// --- Stream endpoint ---

export const observerStream = api.streamInOut<
	ObserverHandshake,
	ObserverInMessage,
	ApiOutMessage
>(
	{ path: "/internal/observer/stream", expose: true, auth: true },
	async (handshake, stream) => {
		const { observerId } = handshake;
		log.info("observer stream connecting", { observerId });

		registerStream(observerId, stream);

		try {
			const activeSeats = await getActiveSeatsPayload();
			await stream.send(activeSeats);

			for await (const msg of stream) {
				try {
					switch (msg.type) {
						case "session_update":
							await handleSessionUpdate(msg as SessionUpdateMsg);
							break;
						case "balance_update":
							await handleBalanceUpdate(msg as BalanceUpdateMsg);
							break;
						case "transactions_update":
							await handleTransactionsUpdate(
								msg as TransactionsUpdateMsg,
							);
							break;
						case "accounts_discovered":
							await handleAccountsDiscovered(
								msg as AccountsDiscoveredMsg,
							);
							break;
						case "heartbeat":
							log.info("observer heartbeat", {
								observerId,
								timestamp: msg.timestamp,
								activeSeats: msg.activeSeatsCount,
							});
							break;
						case "screenshot":
							await handleScreenshot(msg as ScreenshotMsg);
							break;
					}
				} catch (err) {
					log.error("error processing observer message", {
						type: msg.type,
						error: String(err),
					});
				}
			}
		} catch (err) {
			if (
				err instanceof APIError ||
				String(err).includes("stream closed")
			) {
				log.info("observer stream closed", { observerId });
			} else {
				log.error("observer stream error", {
					observerId,
					error: String(err),
				});
			}
		} finally {
			unregisterStream(observerId);
		}
	},
);
