import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { secret } from "encore.dev/config";
import { orm } from "../lib/db.js";
import { encrypt, decrypt } from "../lib/crypto.js";
import { eq, and } from "drizzle-orm";

const EncryptionKey = secret("EncryptionKey");
import {
	seats,
	seat2faConfigs,
	seatAccountScopes,
} from "@hex-pro/bank-integration-database/schema";

const API_PUBLIC_URL = process.env.API_PUBLIC_URL || "http://localhost:4000";

function buildWebhookUrl(seatId: string): string {
	return `${API_PUBLIC_URL.replace(/\/+$/, "")}/webhooks/sms/${seatId}`;
}

// --- Request / Response Types ---

interface CreateSeatRequest {
	bank: "anz" | "commbank" | "nab" | "westpac";
	username: string;
	password: string;
	label?: string;
}

interface TwoFaSummary {
	method: string;
	smsProvider: string | null;
	phoneNumber: string | null;
	webhookUrl: string | null;
}

interface SeatSummary {
	id: string;
	bank: string;
	username: string;
	label: string | null;
	isActive: boolean;
	createdAt: string;
	twoFaSummary: TwoFaSummary | null;
}

interface CreateSeatResponse {
	seat: SeatSummary;
}

interface ListSeatsResponse {
	seats: SeatSummary[];
}

interface GetSeatRequest {
	id: string;
}

interface TwoFaConfigResponse {
	method: string;
	smsProvider: string | null;
	phoneNumber: string | null;
	forwardTo: string | null;
	notificationEmail: string | null;
	hasApiKey: boolean;
	hasApiSecret: boolean;
	webhookUrl: string | null;
}

interface AccountScopeResponse {
	identifier: string;
	type: string;
}

interface SeatDetailResponse {
	id: string;
	bank: string;
	username: string;
	label: string | null;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
	twoFaConfig: TwoFaConfigResponse | null;
	scopes: AccountScopeResponse[];
}

interface UpdateSeatRequest {
	id: string;
	bank?: string;
	username?: string;
	password?: string;
	label?: string;
	isActive?: boolean;
}

interface UpdateSeatResponse {
	seat: SeatSummary;
}

interface DeleteSeatRequest {
	id: string;
}

interface DeleteSeatResponse {
	deleted: boolean;
}

interface Update2faRequest {
	id: string;
	method: "sms" | "app";
	smsProvider?: "twilio" | "plivo";
	apiKey?: string;
	apiSecret?: string;
	phoneNumber?: string;
	forwardTo?: string;
	notificationEmail?: string;
}

interface Update2faResponse {
	method: string;
	smsProvider: string | null;
	phoneNumber: string | null;
	forwardTo: string | null;
	notificationEmail: string | null;
	hasApiKey: boolean;
	hasApiSecret: boolean;
}

interface ScopeItem {
	identifier: string;
	type: "name" | "number";
}

interface UpdateScopesRequest {
	id: string;
	scopes: ScopeItem[];
}

interface UpdateScopesResponse {
	scopes: AccountScopeResponse[];
}

// --- Helper ---

function requireUser(): string {
	const auth = getAuthData();
	if (!auth) throw APIError.unauthenticated("not authenticated");
	return auth.userID;
}

async function verifySeatOwnership(seatId: string, userId: string) {
	const [seat] = await orm
		.select({ id: seats.id, userId: seats.userId })
		.from(seats)
		.where(and(eq(seats.id, seatId), eq(seats.userId, userId)))
		.limit(1);

	if (!seat) throw APIError.notFound("seat not found");
	return seat;
}

function toSeatSummary(
	row: {
		id: string;
		bank: string;
		label: string | null;
		encryptedUsername: string;
		isActive: boolean;
		createdAt: Date;
	},
	twoFa?: {
		method: string;
		smsProvider: string | null;
		smsPhoneNumber: string | null;
	} | null,
): SeatSummary {
	return {
		id: row.id,
		bank: row.bank,
		username: decrypt(row.encryptedUsername, EncryptionKey()),
		label: row.label,
		isActive: row.isActive,
		createdAt: row.createdAt.toISOString(),
		twoFaSummary: twoFa
			? {
					method: twoFa.method,
					smsProvider: twoFa.smsProvider,
					phoneNumber: twoFa.smsPhoneNumber,
					webhookUrl:
						twoFa.method === "sms" ? buildWebhookUrl(row.id) : null,
				}
			: null,
	};
}

// --- Observer notifications (may not exist yet) ---

async function getSeatForObserver(seatId: string) {
	const [seat] = await orm
		.select()
		.from(seats)
		.where(eq(seats.id, seatId))
		.limit(1);
	if (!seat) return null;
	return {
		id: seat.id,
		bank: seat.bank,
		username: decrypt(seat.encryptedUsername, EncryptionKey()),
		password: decrypt(seat.encryptedPassword, EncryptionKey()),
		isActive: seat.isActive,
	};
}

async function notifySeatAdded(seatId: string): Promise<void> {
	try {
		const seat = await getSeatForObserver(seatId);
		if (!seat) return;
		const { sendSeatAdded } = await import("../observer/connections.js");
		await sendSeatAdded(seat);
	} catch {
		// observer module not yet available
	}
}

async function notifySeatUpdated(seatId: string): Promise<void> {
	try {
		const seat = await getSeatForObserver(seatId);
		if (!seat) return;
		const { sendSeatUpdate } = await import("../observer/connections.js");
		await sendSeatUpdate(seat);
	} catch {
		// observer module not yet available
	}
}

async function notifySeatDeleted(seatId: string): Promise<void> {
	try {
		const { sendSeatDeleted } = await import("../observer/connections.js");
		await sendSeatDeleted(seatId);
	} catch {
		// observer module not yet available
	}
}

// --- Endpoints ---

export const createSeat = api(
	{ method: "POST", path: "/v1/seats", expose: true, auth: true },
	async (req: CreateSeatRequest): Promise<CreateSeatResponse> => {
		const userId = requireUser();

		const encryptedUsername = encrypt(req.username, EncryptionKey());
		const encryptedPassword = encrypt(req.password, EncryptionKey());

		const [inserted] = await orm
			.insert(seats)
			.values({
				userId,
				bank: req.bank,
				label: req.label ?? null,
				encryptedUsername,
				encryptedPassword,
			})
			.returning({
				id: seats.id,
				bank: seats.bank,
				label: seats.label,
				encryptedUsername: seats.encryptedUsername,
				isActive: seats.isActive,
				createdAt: seats.createdAt,
			});

		await notifySeatAdded(inserted.id);

		return { seat: toSeatSummary(inserted, null) };
	},
);

export const listSeats = api(
	{ method: "GET", path: "/v1/seats", expose: true, auth: true },
	async (): Promise<ListSeatsResponse> => {
		const userId = requireUser();

		const rows = await orm
			.select({
				id: seats.id,
				bank: seats.bank,
				label: seats.label,
				encryptedUsername: seats.encryptedUsername,
				isActive: seats.isActive,
				createdAt: seats.createdAt,
			})
			.from(seats)
			.where(eq(seats.userId, userId));

		const seatIds = rows.map((r) => r.id);
		let tfaMap = new Map<
			string,
			{ method: string; smsProvider: string | null; smsPhoneNumber: string | null }
		>();

		if (seatIds.length > 0) {
			const tfaRows = await orm
				.select({
					seatId: seat2faConfigs.seatId,
					method: seat2faConfigs.method,
					smsProvider: seat2faConfigs.smsProvider,
					smsPhoneNumber: seat2faConfigs.smsPhoneNumber,
				})
				.from(seat2faConfigs);

			for (const row of tfaRows) {
				if (seatIds.includes(row.seatId)) {
					tfaMap.set(row.seatId, row);
				}
			}
		}

		return {
			seats: rows.map((row) => toSeatSummary(row, tfaMap.get(row.id))),
		};
	},
);

export const getSeat = api(
	{ method: "GET", path: "/v1/seats/:id", expose: true, auth: true },
	async (req: GetSeatRequest): Promise<SeatDetailResponse> => {
		const userId = requireUser();

		const [seat] = await orm
			.select({
				id: seats.id,
				bank: seats.bank,
				label: seats.label,
				encryptedUsername: seats.encryptedUsername,
				isActive: seats.isActive,
				createdAt: seats.createdAt,
				updatedAt: seats.updatedAt,
				userId: seats.userId,
			})
			.from(seats)
			.where(and(eq(seats.id, req.id), eq(seats.userId, userId)))
			.limit(1);

		if (!seat) throw APIError.notFound("seat not found");

		const [twoFa] = await orm
			.select({
				method: seat2faConfigs.method,
				smsProvider: seat2faConfigs.smsProvider,
				smsPhoneNumber: seat2faConfigs.smsPhoneNumber,
				smsForwardTo: seat2faConfigs.smsForwardTo,
				notificationEmail: seat2faConfigs.notificationEmail,
				encryptedSmsApiKey: seat2faConfigs.encryptedSmsApiKey,
				encryptedSmsApiSecret: seat2faConfigs.encryptedSmsApiSecret,
			})
			.from(seat2faConfigs)
			.where(eq(seat2faConfigs.seatId, req.id))
			.limit(1);

		const scopeRows = await orm
			.select({
				identifier: seatAccountScopes.identifier,
				identifierType: seatAccountScopes.identifierType,
			})
			.from(seatAccountScopes)
			.where(eq(seatAccountScopes.seatId, req.id));

		return {
			id: seat.id,
			bank: seat.bank,
			username: decrypt(seat.encryptedUsername, EncryptionKey()),
			label: seat.label,
			isActive: seat.isActive,
			createdAt: seat.createdAt.toISOString(),
			updatedAt: seat.updatedAt.toISOString(),
			twoFaConfig: twoFa
				? {
						method: twoFa.method,
						smsProvider: twoFa.smsProvider,
						phoneNumber: twoFa.smsPhoneNumber,
						forwardTo: twoFa.smsForwardTo,
						notificationEmail: twoFa.notificationEmail,
						hasApiKey: !!twoFa.encryptedSmsApiKey,
						hasApiSecret: !!twoFa.encryptedSmsApiSecret,
						webhookUrl:
							twoFa.method === "sms"
								? buildWebhookUrl(req.id)
								: null,
					}
				: null,
			scopes: scopeRows.map((s) => ({
				identifier: s.identifier,
				type: s.identifierType,
			})),
		};
	},
);

export const updateSeat = api(
	{ method: "PUT", path: "/v1/seats/:id", expose: true, auth: true },
	async (req: UpdateSeatRequest): Promise<UpdateSeatResponse> => {
		const userId = requireUser();
		await verifySeatOwnership(req.id, userId);

		const updates: Record<string, unknown> = {
			updatedAt: new Date(),
		};

		if (req.bank !== undefined) updates.bank = req.bank;
		if (req.label !== undefined) updates.label = req.label || null;
		if (req.isActive !== undefined) updates.isActive = req.isActive;
		if (req.username !== undefined) updates.encryptedUsername = encrypt(req.username, EncryptionKey());
		if (req.password !== undefined) updates.encryptedPassword = encrypt(req.password, EncryptionKey());

		const [updated] = await orm
			.update(seats)
			.set(updates)
			.where(eq(seats.id, req.id))
			.returning({
				id: seats.id,
				bank: seats.bank,
				label: seats.label,
				encryptedUsername: seats.encryptedUsername,
				isActive: seats.isActive,
				createdAt: seats.createdAt,
			});

		await notifySeatUpdated(updated.id);

		const [tfa] = await orm
			.select({
				method: seat2faConfigs.method,
				smsProvider: seat2faConfigs.smsProvider,
				smsPhoneNumber: seat2faConfigs.smsPhoneNumber,
			})
			.from(seat2faConfigs)
			.where(eq(seat2faConfigs.seatId, updated.id))
			.limit(1);

		return { seat: toSeatSummary(updated, tfa ?? null) };
	},
);

export const deleteSeat = api(
	{ method: "DELETE", path: "/v1/seats/:id", expose: true, auth: true },
	async (req: DeleteSeatRequest): Promise<DeleteSeatResponse> => {
		const userId = requireUser();
		await verifySeatOwnership(req.id, userId);

		await notifySeatDeleted(req.id);

		await orm.delete(seats).where(eq(seats.id, req.id));

		return { deleted: true };
	},
);

export const update2fa = api(
	{ method: "PUT", path: "/v1/seats/:id/2fa", expose: true, auth: true },
	async (req: Update2faRequest): Promise<Update2faResponse> => {
		const userId = requireUser();
		await verifySeatOwnership(req.id, userId);

		const values: Record<string, unknown> = {
			seatId: req.id,
			method: req.method,
			smsProvider: req.smsProvider ?? null,
			smsPhoneNumber: req.phoneNumber ?? null,
			smsForwardTo: req.forwardTo ?? null,
			notificationEmail: req.notificationEmail ?? null,
			updatedAt: new Date(),
		};

		if (req.apiKey) {
			values.encryptedSmsApiKey = encrypt(req.apiKey, EncryptionKey());
		}
		if (req.apiSecret) {
			values.encryptedSmsApiSecret = encrypt(req.apiSecret, EncryptionKey());
		}

		const [result] = await orm
			.insert(seat2faConfigs)
			.values(values as typeof seat2faConfigs.$inferInsert)
			.onConflictDoUpdate({
				target: seat2faConfigs.seatId,
				set: values,
			})
			.returning({
				method: seat2faConfigs.method,
				smsProvider: seat2faConfigs.smsProvider,
				smsPhoneNumber: seat2faConfigs.smsPhoneNumber,
				smsForwardTo: seat2faConfigs.smsForwardTo,
				notificationEmail: seat2faConfigs.notificationEmail,
				encryptedSmsApiKey: seat2faConfigs.encryptedSmsApiKey,
				encryptedSmsApiSecret: seat2faConfigs.encryptedSmsApiSecret,
			});

		return {
			method: result.method,
			smsProvider: result.smsProvider,
			phoneNumber: result.smsPhoneNumber,
			forwardTo: result.smsForwardTo,
			notificationEmail: result.notificationEmail,
			hasApiKey: !!result.encryptedSmsApiKey,
			hasApiSecret: !!result.encryptedSmsApiSecret,
		};
	},
);

export const updateScopes = api(
	{ method: "PUT", path: "/v1/seats/:id/scopes", expose: true, auth: true },
	async (req: UpdateScopesRequest): Promise<UpdateScopesResponse> => {
		const userId = requireUser();
		await verifySeatOwnership(req.id, userId);

		await orm
			.delete(seatAccountScopes)
			.where(eq(seatAccountScopes.seatId, req.id));

		if (req.scopes.length === 0) {
			return { scopes: [] };
		}

		const inserted = await orm
			.insert(seatAccountScopes)
			.values(
				req.scopes.map((s) => ({
					seatId: req.id,
					identifier: s.identifier,
					identifierType: s.type,
				})),
			)
			.returning({
				identifier: seatAccountScopes.identifier,
				identifierType: seatAccountScopes.identifierType,
			});

		return {
			scopes: inserted.map((s) => ({
				identifier: s.identifier,
				type: s.identifierType,
			})),
		};
	},
);
