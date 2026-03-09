import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { orm } from "../lib/db.js";
import { eq, and } from "drizzle-orm";
import { userWebhooks } from "@hex-pro/bank-integration-database/schema";
import { randomBytes } from "node:crypto";

// --- Types ---

interface CreateWebhookRequest {
	url: string;
	events: string[];
}

interface WebhookItem {
	id: string;
	url: string;
	events: string[];
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

interface WebhookCreatedResponse {
	id: string;
	url: string;
	events: string[];
	secret: string;
	isActive: boolean;
	createdAt: string;
}

interface ListWebhooksResponse {
	webhooks: WebhookItem[];
}

interface UpdateWebhookRequest {
	id: string;
	url?: string;
	events?: string[];
	isActive?: boolean;
}

interface UpdateWebhookResponse {
	webhook: WebhookItem;
}

interface DeleteWebhookRequest {
	id: string;
}

interface DeleteWebhookResponse {
	deleted: boolean;
}

// --- Helpers ---

function requireUser(): string {
	const auth = getAuthData();
	if (!auth) throw APIError.unauthenticated("not authenticated");
	return auth.userID;
}

// --- Endpoints ---

export const createWebhook = api(
	{ method: "POST", path: "/v1/webhooks", expose: true, auth: true },
	async (req: CreateWebhookRequest): Promise<WebhookCreatedResponse> => {
		const userId = requireUser();

		const secret = randomBytes(32).toString("hex");

		const [inserted] = await orm
			.insert(userWebhooks)
			.values({
				userId,
				url: req.url,
				events: req.events,
				secret,
			})
			.returning({
				id: userWebhooks.id,
				url: userWebhooks.url,
				events: userWebhooks.events,
				secret: userWebhooks.secret,
				isActive: userWebhooks.isActive,
				createdAt: userWebhooks.createdAt,
			});

		return {
			id: inserted.id,
			url: inserted.url,
			events: inserted.events,
			secret: inserted.secret,
			isActive: inserted.isActive,
			createdAt: inserted.createdAt.toISOString(),
		};
	},
);

export const listWebhooks = api(
	{ method: "GET", path: "/v1/webhooks", expose: true, auth: true },
	async (): Promise<ListWebhooksResponse> => {
		const userId = requireUser();

		const rows = await orm
			.select({
				id: userWebhooks.id,
				url: userWebhooks.url,
				events: userWebhooks.events,
				isActive: userWebhooks.isActive,
				createdAt: userWebhooks.createdAt,
				updatedAt: userWebhooks.updatedAt,
			})
			.from(userWebhooks)
			.where(eq(userWebhooks.userId, userId));

		return {
			webhooks: rows.map((r) => ({
				id: r.id,
				url: r.url,
				events: r.events,
				isActive: r.isActive,
				createdAt: r.createdAt.toISOString(),
				updatedAt: r.updatedAt.toISOString(),
			})),
		};
	},
);

export const updateWebhook = api(
	{ method: "PUT", path: "/v1/webhooks/:id", expose: true, auth: true },
	async (req: UpdateWebhookRequest): Promise<UpdateWebhookResponse> => {
		const userId = requireUser();

		const [existing] = await orm
			.select({ id: userWebhooks.id })
			.from(userWebhooks)
			.where(and(eq(userWebhooks.id, req.id), eq(userWebhooks.userId, userId)))
			.limit(1);

		if (!existing) throw APIError.notFound("webhook not found");

		const updates: Record<string, unknown> = {
			updatedAt: new Date(),
		};

		if (req.url !== undefined) updates.url = req.url;
		if (req.events !== undefined) updates.events = req.events;
		if (req.isActive !== undefined) updates.isActive = req.isActive;

		const [updated] = await orm
			.update(userWebhooks)
			.set(updates)
			.where(eq(userWebhooks.id, req.id))
			.returning({
				id: userWebhooks.id,
				url: userWebhooks.url,
				events: userWebhooks.events,
				isActive: userWebhooks.isActive,
				createdAt: userWebhooks.createdAt,
				updatedAt: userWebhooks.updatedAt,
			});

		return {
			webhook: {
				id: updated.id,
				url: updated.url,
				events: updated.events,
				isActive: updated.isActive,
				createdAt: updated.createdAt.toISOString(),
				updatedAt: updated.updatedAt.toISOString(),
			},
		};
	},
);

export const deleteWebhook = api(
	{ method: "DELETE", path: "/v1/webhooks/:id", expose: true, auth: true },
	async (req: DeleteWebhookRequest): Promise<DeleteWebhookResponse> => {
		const userId = requireUser();

		const [existing] = await orm
			.select({ id: userWebhooks.id })
			.from(userWebhooks)
			.where(and(eq(userWebhooks.id, req.id), eq(userWebhooks.userId, userId)))
			.limit(1);

		if (!existing) throw APIError.notFound("webhook not found");

		await orm.delete(userWebhooks).where(eq(userWebhooks.id, req.id));

		return { deleted: true };
	},
);
