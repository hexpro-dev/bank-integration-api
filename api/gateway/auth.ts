import { Header, Gateway, APIError } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { secret } from "encore.dev/config";
import { jwtVerify } from "jose";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { orm } from "../lib/db.js";
import { apiTokens } from "@hex-pro/bank-integration-database/schema";

const JwtSecret = secret("JwtSecret");
const InternalApiKey = secret("InternalApiKey");

interface AuthParams {
	authorization: Header<"Authorization">;
}

interface AuthData {
	userID: string;
	role: "admin" | "user" | "observer";
	authMethod: "jwt" | "apikey" | "internal";
}

export const auth = authHandler<AuthParams, AuthData>(async (params) => {
	const header = params.authorization;
	if (!header) {
		throw APIError.unauthenticated("missing authorization header");
	}

	if (header.startsWith("Bearer ")) {
		return handleJwt(header.slice(7));
	}

	if (header.startsWith("ApiKey ")) {
		return handleApiKey(header.slice(7));
	}

	if (header.startsWith("Internal ")) {
		return handleInternal(header.slice(9));
	}

	throw APIError.unauthenticated("unsupported authorization scheme");
});

async function handleJwt(token: string): Promise<AuthData> {
	try {
		const { payload } = await jwtVerify(
			token,
			new TextEncoder().encode(JwtSecret()),
		);

		if (!payload.sub) {
			throw APIError.unauthenticated("invalid jwt: missing sub");
		}

		return {
			userID: payload.sub,
			role: (payload.role as AuthData["role"]) ?? "user",
			authMethod: "jwt",
		};
	} catch (err) {
		if (err instanceof APIError) throw err;
		throw APIError.unauthenticated("invalid jwt");
	}
}

async function handleApiKey(token: string): Promise<AuthData> {
	const hash = createHash("sha256").update(token).digest("hex");

	const [row] = await orm
		.select({
			id: apiTokens.id,
			userId: apiTokens.userId,
			isActive: apiTokens.isActive,
			expiresAt: apiTokens.expiresAt,
		})
		.from(apiTokens)
		.where(eq(apiTokens.tokenHash, hash))
		.limit(1);

	if (!row) {
		throw APIError.unauthenticated("invalid api token");
	}

	if (!row.isActive) {
		throw APIError.unauthenticated("api token is inactive");
	}

	if (row.expiresAt && row.expiresAt < new Date()) {
		throw APIError.unauthenticated("api token has expired");
	}

	await orm
		.update(apiTokens)
		.set({ lastUsedAt: new Date() })
		.where(eq(apiTokens.id, row.id));

	return {
		userID: row.userId,
		role: "user",
		authMethod: "apikey",
	};
}

async function handleInternal(key: string): Promise<AuthData> {
	if (key !== InternalApiKey()) {
		throw APIError.unauthenticated("invalid internal key");
	}

	return {
		userID: "internal",
		role: "admin",
		authMethod: "internal",
	};
}

export const gateway = new Gateway({
	authHandler: auth,
});
