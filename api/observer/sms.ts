import { api } from "encore.dev/api";
import { eq } from "drizzle-orm";
import log from "encore.dev/log";
import { secret } from "encore.dev/config";
import { orm } from "../lib/db.js";
import {
	twoFactorCodes,
	seat2faConfigs,
	smsWebhookLogs,
} from "@hex-pro/bank-integration-database/schema";
import { send2FACode } from "./connections.js";
import { decrypt } from "../lib/crypto.js";
import { forwardSmsViaProvider } from "../lib/notifications.js";

const EncryptionKey = secret("EncryptionKey");

function parseVerificationCode(body: string): string | null {
	const match = body.match(/\b(\d{4,8})\b/);
	return match ? match[1] : null;
}

async function attemptSmsForward(seatId: string, smsBody: string): Promise<void> {
	const [tfaConfig] = await orm
		.select()
		.from(seat2faConfigs)
		.where(eq(seat2faConfigs.seatId, seatId))
		.limit(1);

	if (!tfaConfig?.smsForwardTo?.length || !tfaConfig.smsProvider) return;

	if (
		!tfaConfig.encryptedSmsApiKey ||
		!tfaConfig.encryptedSmsApiSecret ||
		!tfaConfig.smsPhoneNumber
	) {
		log.warn("SMS forwarding configured but credentials incomplete", {
			seatId,
			hasApiKey: !!tfaConfig.encryptedSmsApiKey,
			hasApiSecret: !!tfaConfig.encryptedSmsApiSecret,
			hasPhoneNumber: !!tfaConfig.smsPhoneNumber,
		});
		return;
	}

	const apiKey = decrypt(tfaConfig.encryptedSmsApiKey, EncryptionKey());
	const apiSecret = decrypt(tfaConfig.encryptedSmsApiSecret, EncryptionKey());

	const results = await Promise.allSettled(
		tfaConfig.smsForwardTo.map((to) =>
			forwardSmsViaProvider(
				tfaConfig.smsProvider!,
				apiKey,
				apiSecret,
				tfaConfig.smsPhoneNumber!,
				to,
				smsBody,
			),
		),
	);

	for (let i = 0; i < results.length; i++) {
		const to = tfaConfig.smsForwardTo[i];
		const result = results[i];
		if (result.status === "fulfilled" && result.value) {
			log.info("SMS forwarded", { seatId, provider: tfaConfig.smsProvider, to });
		} else {
			const reason = result.status === "rejected" ? String(result.reason) : "provider returned false";
			log.warn("SMS forward failed", { seatId, provider: tfaConfig.smsProvider, to, reason });
		}
	}
}

export const smsWebhook = api.raw(
	{
		expose: true,
		path: "/webhooks/sms/:seatId",
		method: "POST",
	},
	async (req, res) => {
		const seatId = req.url?.split("/webhooks/sms/")[1]?.split("?")[0];

		if (!seatId) {
			res.writeHead(400, { "Content-Type": "text/plain" });
			res.end("missing seatId");
			return;
		}

		let body = "";
		for await (const chunk of req) {
			body += chunk;
		}

		let smsBody = "";
		let smsFrom = "";

		const contentType = req.headers["content-type"] || "";

		if (contentType.includes("application/x-www-form-urlencoded")) {
			const params = new URLSearchParams(body);
			smsBody = params.get("Body") || params.get("Text") || "";
			smsFrom = params.get("From") || "";
		} else if (contentType.includes("application/json")) {
			try {
				const json = JSON.parse(body);
				smsBody = json.Body || json.text || json.body || "";
				smsFrom = json.From || json.from || "";
			} catch {
				log.warn("failed to parse SMS webhook JSON body");
			}
		}

		const code = smsBody ? parseVerificationCode(smsBody) : null;
		const now = new Date();

		try {
			await orm.insert(smsWebhookLogs).values({
				seatId,
				fromNumber: smsFrom || null,
				messageBody: smsBody || null,
				rawBody: body,
				contentType: contentType || null,
				extractedCode: code,
				receivedAt: now,
			});
		} catch (err) {
			log.error("failed to log SMS webhook", { seatId, error: String(err) });
		}

		if (!smsBody) {
			log.warn("SMS webhook received with empty body", { seatId });
			res.writeHead(200, { "Content-Type": "text/xml" });
			res.end("<Response></Response>");
			return;
		}

		attemptSmsForward(seatId, smsBody).catch((err) =>
			log.error("SMS forwarding error", { seatId, error: String(err) }),
		);

		if (code) {
			await orm.insert(twoFactorCodes).values({
				seatId,
				code,
				source: smsFrom || "sms_webhook",
				receivedAt: now,
			});

			log.info("2FA code received via SMS", { seatId, from: smsFrom });

			const sent = await send2FACode(seatId, code);
			if (!sent) {
				log.warn("no active observer stream to deliver 2FA code", { seatId });
			}
		}

		res.writeHead(200, { "Content-Type": "text/xml" });
		res.end("<Response></Response>");
	},
);
