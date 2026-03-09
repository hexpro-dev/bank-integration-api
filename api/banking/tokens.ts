import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { orm } from "../lib/db.js";
import { eq, and } from "drizzle-orm";
import { apiTokens } from "@hex-pro/bank-integration-database/schema";
import { randomBytes, createHash, randomUUID } from "node:crypto";

// --- Types ---

interface CreateTokenRequest {
	name: string;
	scopes?: string[];
	expiresInDays?: number;
}

interface TokenCreatedResponse {
	id: string;
	name: string;
	token: string;
	scopes: string[];
	expiresAt: string | null;
}

interface TokenSummary {
	id: string;
	name: string;
	scopes: string[];
	lastUsedAt: string | null;
	expiresAt: string | null;
	isActive: boolean;
	createdAt: string;
}

interface ListTokensResponse {
	tokens: TokenSummary[];
}

interface DeleteTokenRequest {
	id: string;
}

interface DeleteTokenResponse {
	deactivated: boolean;
}

// --- Helpers ---

function requireUser(): string {
	const auth = getAuthData();
	if (!auth) throw APIError.unauthenticated("not authenticated");
	return auth.userID;
}

function generateToken(): string {
	const prefix = randomUUID().replace(/-/g, "");
	const suffix = randomBytes(16).toString("hex");
	return `bk_${prefix}${suffix}`;
}

function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

// --- Endpoints ---

export const createToken = api(
	{ method: "POST", path: "/v1/tokens", expose: true, auth: true },
	async (req: CreateTokenRequest): Promise<TokenCreatedResponse> => {
		const userId = requireUser();

		const rawToken = generateToken();
		const tokenHash = hashToken(rawToken);

		const scopes = req.scopes ?? [];
		const expiresAt = req.expiresInDays
			? new Date(Date.now() + req.expiresInDays * 86_400_000)
			: null;

		const [inserted] = await orm
			.insert(apiTokens)
			.values({
				userId,
				name: req.name,
				tokenHash,
				scopes,
				expiresAt,
			})
			.returning({
				id: apiTokens.id,
				name: apiTokens.name,
				scopes: apiTokens.scopes,
				expiresAt: apiTokens.expiresAt,
			});

		return {
			id: inserted.id,
			name: inserted.name,
			token: rawToken,
			scopes: inserted.scopes,
			expiresAt: inserted.expiresAt?.toISOString() ?? null,
		};
	},
);

export const listTokens = api(
	{ method: "GET", path: "/v1/tokens", expose: true, auth: true },
	async (): Promise<ListTokensResponse> => {
		const userId = requireUser();

		const rows = await orm
			.select({
				id: apiTokens.id,
				name: apiTokens.name,
				scopes: apiTokens.scopes,
				lastUsedAt: apiTokens.lastUsedAt,
				expiresAt: apiTokens.expiresAt,
				isActive: apiTokens.isActive,
				createdAt: apiTokens.createdAt,
			})
			.from(apiTokens)
			.where(eq(apiTokens.userId, userId));

		return {
			tokens: rows.map((r) => ({
				id: r.id,
				name: r.name,
				scopes: r.scopes,
				lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
				expiresAt: r.expiresAt?.toISOString() ?? null,
				isActive: r.isActive,
				createdAt: r.createdAt.toISOString(),
			})),
		};
	},
);

export const deleteToken = api(
	{ method: "DELETE", path: "/v1/tokens/:id", expose: true, auth: true },
	async (req: DeleteTokenRequest): Promise<DeleteTokenResponse> => {
		const userId = requireUser();

		const [token] = await orm
			.select({ id: apiTokens.id })
			.from(apiTokens)
			.where(and(eq(apiTokens.id, req.id), eq(apiTokens.userId, userId)))
			.limit(1);

		if (!token) throw APIError.notFound("token not found");

		await orm
			.update(apiTokens)
			.set({ isActive: false, updatedAt: new Date() })
			.where(eq(apiTokens.id, req.id));

		return { deactivated: true };
	},
);
