import "dotenv/config";
import { loadConfig } from "./config.js";
import { Orchestrator } from "./orchestrator/index.js";

async function main(): Promise<void> {
	console.log("Starting bank-integration observer...");
	const config = loadConfig();
	console.log(`Observer ID: ${config.observerId}`);
	console.log(`API: ${config.apiBaseUrl}`);
	console.log(`Headless: ${config.headless}`);

	const orchestrator = new Orchestrator(config);

	process.on("SIGINT", async () => {
		console.log("Shutting down...");
		await orchestrator.stopAll();
		process.exit(0);
	});

	process.on("SIGTERM", async () => {
		console.log("Shutting down...");
		await orchestrator.stopAll();
		process.exit(0);
	});

	await orchestrator.start();
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
