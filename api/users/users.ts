import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { secret } from "encore.dev/config";
import { SignJWT } from "jose";
import { hash, verify } from "@node-rs/argon2";
import { orm } from "../lib/db.js";
import { users } from "@hex-pro/bank-integration-database/schema";
import { eq } from "drizzle-orm";

const jwtSecret = secret("JwtSecret");

// Request / Response interfaces

interface RegisterRequest {
	email: string;
	name: string;
	password: string;
	inviteToken?: string;
}

interface RegisterResponse {
	id: string;
	email: string;
	name: string;
	role: "admin" | "user";
}

interface LoginRequest {
	email: string;
	password: string;
}

interface LoginResponse {
	token: string;
	user: {
		id: string;
		email: string;
		name: string;
		role: "admin" | "user";
	};
}

interface ProfileResponse {
	id: string;
	email: string;
	name: string;
	role: "admin" | "user";
}

interface ChangePasswordRequest {
	currentPassword: string;
	newPassword: string;
}

interface ChangePasswordResponse {
	success: boolean;
}

interface InviteRequest {
	email?: string;
}

interface InviteResponse {
	inviteToken: string;
}

interface UserItem {
	id: string;
	email: string;
	name: string;
	role: "admin" | "user";
	createdAt: string;
}

interface ListUsersResponse {
	users: UserItem[];
}

// Endpoints

export const register = api<RegisterRequest, RegisterResponse>(
	{ expose: true, auth: false, method: "POST", path: "/auth/register" },
	async (req) => {
		if (!req.email || !req.password || !req.name) {
			throw APIError.invalidArgument("email, name and password are required");
		}

		const existingUsers = await orm.select({ id: users.id }).from(users).limit(1);
		const isFirstUser = existingUsers.length === 0;

		if (!isFirstUser) {
			if (!req.inviteToken) {
				throw APIError.permissionDenied("registration requires an invite token");
			}
			if (req.inviteToken !== jwtSecret()) {
				throw APIError.permissionDenied("invalid invite token");
			}
		}

		const passwordHash = await hash(req.password);

		const [user] = await orm
			.insert(users)
			.values({
				email: req.email,
				name: req.name,
				passwordHash,
				role: isFirstUser ? "admin" : "user",
				isFirstUser,
			})
			.returning({
				id: users.id,
				email: users.email,
				name: users.name,
				role: users.role,
			});

		if (!user) {
			throw APIError.internal("failed to create user");
		}

		return {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
		};
	},
);

export const login = api<LoginRequest, LoginResponse>(
	{ expose: true, auth: false, method: "POST", path: "/auth/login" },
	async (req) => {
		if (!req.email || !req.password) {
			throw APIError.invalidArgument("email and password are required");
		}

		const [user] = await orm
			.select({
				id: users.id,
				email: users.email,
				name: users.name,
				role: users.role,
				passwordHash: users.passwordHash,
			})
			.from(users)
			.where(eq(users.email, req.email))
			.limit(1);

		if (!user) {
			throw APIError.unauthenticated("invalid email or password");
		}

		const valid = await verify(user.passwordHash, req.password);
		if (!valid) {
			throw APIError.unauthenticated("invalid email or password");
		}

		const token = await new SignJWT({
			sub: user.id,
			email: user.email,
			role: user.role,
		})
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt()
			.setExpirationTime("7d")
			.sign(new TextEncoder().encode(jwtSecret()));

		return {
			token,
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
			},
		};
	},
);

export const profile = api<void, ProfileResponse>(
	{ expose: true, auth: true, method: "GET", path: "/auth/profile" },
	async () => {
		const authData = getAuthData()!;

		const [user] = await orm
			.select({
				id: users.id,
				email: users.email,
				name: users.name,
				role: users.role,
			})
			.from(users)
			.where(eq(users.id, authData.userID))
			.limit(1);

		if (!user) {
			throw APIError.notFound("user not found");
		}

		return {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
		};
	},
);

export const changePassword = api<ChangePasswordRequest, ChangePasswordResponse>(
	{ expose: true, auth: true, method: "PUT", path: "/auth/password" },
	async (req) => {
		if (!req.currentPassword || !req.newPassword) {
			throw APIError.invalidArgument(
				"currentPassword and newPassword are required",
			);
		}

		const authData = getAuthData()!;

		const [user] = await orm
			.select({ id: users.id, passwordHash: users.passwordHash })
			.from(users)
			.where(eq(users.id, authData.userID))
			.limit(1);

		if (!user) {
			throw APIError.notFound("user not found");
		}

		const valid = await verify(user.passwordHash, req.currentPassword);
		if (!valid) {
			throw APIError.permissionDenied("current password is incorrect");
		}

		const newHash = await hash(req.newPassword);

		await orm
			.update(users)
			.set({ passwordHash: newHash, updatedAt: new Date() })
			.where(eq(users.id, user.id));

		return { success: true };
	},
);

export const invite = api<InviteRequest, InviteResponse>(
	{ expose: true, auth: true, method: "POST", path: "/auth/invite" },
	async (_req) => {
		const authData = getAuthData()!;

		if (authData.role !== "admin") {
			throw APIError.permissionDenied("only admins can generate invite tokens");
		}

		return { inviteToken: jwtSecret() };
	},
);

export const listUsers = api<void, ListUsersResponse>(
	{ expose: true, auth: true, method: "GET", path: "/auth/users" },
	async () => {
		const authData = getAuthData()!;

		if (authData.role !== "admin") {
			throw APIError.permissionDenied("only admins can list users");
		}

		const rows = await orm
			.select({
				id: users.id,
				email: users.email,
				name: users.name,
				role: users.role,
				createdAt: users.createdAt,
			})
			.from(users);

		return {
			users: rows.map((r) => ({
				id: r.id,
				email: r.email,
				name: r.name,
				role: r.role,
				createdAt: r.createdAt.toISOString(),
			})),
		};
	},
);
