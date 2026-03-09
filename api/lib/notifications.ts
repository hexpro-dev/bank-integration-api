import { createTransport } from "nodemailer";
import log from "encore.dev/log";

function getSmtpTransport() {
	const host = process.env.SMTP_HOST;
	if (!host) return null;

	return createTransport({
		host,
		port: parseInt(process.env.SMTP_PORT || "587"),
		secure: process.env.SMTP_SECURE === "true",
		auth: {
			user: process.env.SMTP_USER || "",
			pass: process.env.SMTP_PASS || "",
		},
	});
}

export async function sendEmail(
	to: string,
	subject: string,
	html: string,
): Promise<boolean> {
	const transport = getSmtpTransport();
	if (!transport) {
		log.warn("SMTP not configured, skipping email", { to, subject });
		return false;
	}

	try {
		await transport.sendMail({
			from: process.env.SMTP_FROM || "noreply@bankapi.local",
			to,
			subject,
			html,
		});
		return true;
	} catch (err) {
		log.error("failed to send email", { to, error: String(err) });
		return false;
	}
}

export async function send2FANotification(
	email: string | null,
	seatBank: string,
	screenshotUrl: string,
): Promise<void> {
	if (!email) {
		log.warn("no notification email configured for 2FA app-based auth", {
			bank: seatBank,
		});
		return;
	}

	const subject = `2FA Confirmation Required - ${seatBank.toUpperCase()}`;
	const html = `
		<h2>Two-Factor Authentication Required</h2>
		<p>Your bank observer for <strong>${seatBank.toUpperCase()}</strong> requires app-based 2FA confirmation.</p>
		<p>Please check your authenticator app and approve the login request.</p>
		${screenshotUrl ? `<p><a href="${screenshotUrl}">View 2FA Page Screenshot</a></p>` : ""}
		<p><em>This is an automated message from your bank-integration observer.</em></p>
	`;

	await sendEmail(email, subject, html);
}

export async function forwardSmsViaProvider(
	provider: "twilio" | "plivo",
	apiKey: string,
	apiSecret: string,
	from: string,
	to: string,
	body: string,
): Promise<boolean> {
	try {
		if (provider === "twilio") {
			const twilio = await import("twilio");
			const client = twilio.default(apiKey, apiSecret);
			await client.messages.create({ from, to, body });
			return true;
		}
		log.warn("plivo SMS forwarding not yet implemented");
		return false;
	} catch (err) {
		log.error("SMS forwarding failed", { provider, error: String(err) });
		return false;
	}
}
