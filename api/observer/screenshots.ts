import { api, APIError } from "encore.dev/api";
import { randomBytes } from "node:crypto";

const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

const screenshotStore = new Map<
	string,
	{ data: string; expiresAt: number }
>();

function cleanupExpired(): void {
	const now = Date.now();
	for (const [token, entry] of screenshotStore) {
		if (entry.expiresAt <= now) {
			screenshotStore.delete(token);
		}
	}
}

export function storeScreenshot(imageBase64: string): string {
	cleanupExpired();
	const token = randomBytes(24).toString("hex");
	screenshotStore.set(token, {
		data: imageBase64,
		expiresAt: Date.now() + EXPIRY_MS,
	});
	return token;
}

interface GetScreenshotRequest {
	token: string;
}

interface GetScreenshotResponse {
	imageBase64: string;
}

export const getScreenshot = api<GetScreenshotRequest, GetScreenshotResponse>(
	{
		expose: true,
		auth: false,
		method: "GET",
		path: "/screenshots/:token",
	},
	async (req) => {
		const entry = screenshotStore.get(req.token);

		if (!entry || entry.expiresAt <= Date.now()) {
			if (entry) screenshotStore.delete(req.token);
			throw APIError.notFound("screenshot not found or expired");
		}

		return { imageBase64: entry.data };
	},
);
