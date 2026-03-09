import "dotenv/config";

export interface ObserverConfig {
	apiBaseUrl: string;
	apiWsUrl: string;
	internalApiKey: string;
	chromeVersion: string;
	headless: boolean;
	browserProfilesDir: string;
	observerId: string;
}

function requireEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

export function loadConfig(): ObserverConfig {
	return {
		apiBaseUrl: requireEnv("API_BASE_URL"),
		apiWsUrl: requireEnv("API_WS_URL"),
		internalApiKey: requireEnv("INTERNAL_API_KEY"),
		chromeVersion: process.env.CHROME_VERSION || "131",
		headless: process.env.HEADLESS !== "0",
		browserProfilesDir: process.env.BROWSER_PROFILES_DIR || "./browser-profiles",
		observerId: process.env.OBSERVER_ID || `observer-${Date.now()}`,
	};
}
