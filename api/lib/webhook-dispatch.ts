import { createHmac } from "node:crypto";
import { orm } from "./db.js";
import { userWebhooks } from "@hex-pro/bank-integration-database/schema";
import { eq, and } from "drizzle-orm";
import log from "encore.dev/log";

interface WebhookPayload {
	event: string;
	data: Record<string, unknown>;
	timestamp: string;
}

function signPayload(payload: string, secret: string): string {
	return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function dispatchWebhooks(
	userId: string,
	event: string,
	data: Record<string, unknown>,
): Promise<void> {
	const webhooks = await orm
		.select()
		.from(userWebhooks)
		.where(and(eq(userWebhooks.userId, userId), eq(userWebhooks.isActive, true)));

	const payload: WebhookPayload = {
		event,
		data,
		timestamp: new Date().toISOString(),
	};

	const body = JSON.stringify(payload);

	for (const webhook of webhooks) {
		if (!webhook.events.includes(event)) continue;

		const signature = signPayload(body, webhook.secret);

		try {
			const response = await fetch(webhook.url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Webhook-Signature": signature,
					"X-Webhook-Event": event,
				},
				body,
				signal: AbortSignal.timeout(10_000),
			});

			if (!response.ok) {
				log.warn("webhook delivery failed", {
					webhookId: webhook.id,
					status: response.status,
				});
			}
		} catch (err) {
			log.error("webhook delivery error", {
				webhookId: webhook.id,
				error: String(err),
			});
		}
	}
}
