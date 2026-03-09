import type { ObserverConfig } from "../config.js";

export class HttpClient {
	constructor(private config: ObserverConfig) {}

	private async request<T>(
		method: string,
		path: string,
		body?: unknown,
	): Promise<T> {
		const url = `${this.config.apiBaseUrl}${path}`;
		const response = await fetch(url, {
			method,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Internal ${this.config.internalApiKey}`,
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});
		if (!response.ok) {
			throw new Error(
				`API ${method} ${path} failed: ${response.status} ${response.statusText}`,
			);
		}
		return response.json() as Promise<T>;
	}

	async healthCheck(): Promise<{ status: string; timestamp: string }> {
		return this.request("GET", "/health");
	}
}
