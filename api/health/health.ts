import { api } from "encore.dev/api";

interface HealthResponse {
	status: "ok";
	timestamp: string;
}

export const healthCheck = api(
	{ method: "GET", path: "/health", expose: true, auth: false },
	async (): Promise<HealthResponse> => {
		return {
			status: "ok",
			timestamp: new Date().toISOString(),
		};
	},
);
