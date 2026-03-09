import type {
	SeatCredentials,
	AccountInfo,
} from "../types.js";
import type { SeatManagerState } from "./types.js";
import type { StreamClient } from "../api/stream-client.js";
import GhostBrowser from "../browser/ghost-browser.js";
import { getModuleForBank } from "../modules/registry.js";
import type { ObserverConfig } from "../config.js";
import type { Browser, Page } from "../browser/types.js";

const BALANCE_REFRESH_MIN_MS = 60_000;
const BALANCE_REFRESH_MAX_MS = 300_000;
const TRANSACTION_REFRESH_MS = 1_800_000;
const TWO_FACTOR_POLL_MS = 1_000;
const TWO_FACTOR_TIMEOUT_MS = 300_000;
const HEARTBEAT_INTERVAL_MS = 60_000;

function randomBetween(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SeatManager {
	state: SeatManagerState;
	private stream: StreamClient;
	private config: ObserverConfig;
	private browserInstance: Browser | null = null;
	private dashboardPage: Page | null = null;
	private running = false;
	private pendingTwoFactorCode: string | null = null;

	constructor(
		credentials: SeatCredentials,
		stream: StreamClient,
		config: ObserverConfig,
	) {
		this.stream = stream;
		this.config = config;
		this.state = {
			seatId: credentials.id,
			credentials,
			status: "idle",
			accounts: [],
			lastBalanceRefresh: 0,
			lastTransactionRefresh: 0,
		};
	}

	async start(): Promise<void> {
		this.running = true;
		const module = getModuleForBank(this.state.credentials.bank);

		try {
			const ghost = new GhostBrowser(this.config);
			this.browserInstance = await ghost.launch(this.state.seatId);
			this.dashboardPage = await ghost.createPage();

			await this.sendSessionUpdate("logging_in");

			const loginResult = await module.login(
				this.dashboardPage,
				this.state.credentials,
			);

			switch (loginResult.status) {
				case "success":
					await this.onLoginSuccess(module);
					break;

				case "2fa_required":
					await this.sendSessionUpdate("2fa_pending");
					await this.await2FA(module);
					break;

				case "failed":
					console.error(
						`[Seat ${this.state.seatId}] Login failed: ${loginResult.errorMessage}`,
					);
					await this.sendSessionUpdate("error", loginResult.errorMessage);
					this.scheduleRetry();
					break;
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`[Seat ${this.state.seatId}] Start error: ${msg}`);
			await this.sendSessionUpdate("error", msg);
			this.scheduleRetry();
		}
	}

	private async onLoginSuccess(module: ReturnType<typeof getModuleForBank>): Promise<void> {
		await this.sendSessionUpdate("active");
		this.state.status = "active";

		if (this.dashboardPage) {
			const discovered = await module.getAccounts(
				this.dashboardPage,
			);

			this.state.accounts = discovered.map((acc, idx) => ({
				id: `${this.state.seatId}-${idx}`,
				...acc,
			}));

			await this.stream.send({
				type: "accounts_discovered",
				seatId: this.state.seatId,
				accounts: discovered,
			});
		}

		await this.startMonitoring(module);
	}

	async await2FA(module: ReturnType<typeof getModuleForBank>): Promise<void> {
		this.state.status = "2fa_pending";
		const start = Date.now();

		while (this.running && Date.now() - start < TWO_FACTOR_TIMEOUT_MS) {
			if (this.pendingTwoFactorCode) {
				const code = this.pendingTwoFactorCode;
				this.pendingTwoFactorCode = null;

				console.log(`[Seat ${this.state.seatId}] Submitting 2FA code`);

				if (!this.dashboardPage) break;

				const result = await module.handle2FA(this.dashboardPage, code);

				if (result) {
					await this.onLoginSuccess(module);
					return;
				}

				console.error(
					`[Seat ${this.state.seatId}] 2FA failed`,
				);
				await this.sendSessionUpdate("error", "2FA verification failed");
				this.scheduleRetry();
				return;
			}

			await sleep(TWO_FACTOR_POLL_MS);
		}

		if (this.running) {
			console.error(`[Seat ${this.state.seatId}] 2FA timed out`);
			await this.sendSessionUpdate("error", "2FA authentication timed out");
			this.scheduleRetry();
		}
	}

	receiveTwoFactorCode(code: string): void {
		console.log(`[Seat ${this.state.seatId}] Received 2FA code`);
		this.pendingTwoFactorCode = code;
	}

	async receiveRefreshRequest(accountId: string): Promise<void> {
		const module = getModuleForBank(this.state.credentials.bank);
		const account = this.state.accounts.find((a) => a.id === accountId);

		if (!account || !this.dashboardPage) {
			console.warn(
				`[Seat ${this.state.seatId}] Refresh requested for unknown account ${accountId}`,
			);
			return;
		}

		console.log(
			`[Seat ${this.state.seatId}] On-demand refresh for account ${accountId}`,
		);

		try {
			const balance = await module.getBalances(
				this.dashboardPage,
				account,
			);
			await this.stream.send({
				type: "balance_update",
				accountId: account.id,
				...balance,
			});

			const txData = await module.getTransactions(
				this.dashboardPage,
				account,
			);
			await this.stream.send({
				type: "transactions_update",
				accountId: account.id,
				transactions: txData,
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(
				`[Seat ${this.state.seatId}] Refresh error for ${accountId}: ${msg}`,
			);
		}
	}

	async startMonitoring(module: ReturnType<typeof getModuleForBank>): Promise<void> {
		console.log(
			`[Seat ${this.state.seatId}] Monitoring ${this.state.accounts.length} accounts`,
		);

		while (this.running && this.state.status === "active") {
			const now = Date.now();

			const balanceInterval = randomBetween(
				BALANCE_REFRESH_MIN_MS,
				BALANCE_REFRESH_MAX_MS,
			);
			if (now - this.state.lastBalanceRefresh >= balanceInterval) {
				await this.refreshBalances(module);
				this.state.lastBalanceRefresh = Date.now();
			}

			if (now - this.state.lastTransactionRefresh >= TRANSACTION_REFRESH_MS) {
				await this.refreshTransactions(module);
				this.state.lastTransactionRefresh = Date.now();
			}

			if (this.dashboardPage) {
				const sessionValid = await module.isSessionValid(
					this.dashboardPage,
				);
				if (!sessionValid) {
					console.warn(`[Seat ${this.state.seatId}] Session expired`);
					await this.sendSessionUpdate("expired");
					this.state.status = "error";
					this.scheduleRetry();
					return;
				}
			}

			await this.stream.send({
				type: "heartbeat",
				timestamp: new Date().toISOString(),
				activeSeatsCount: 1,
			});

			await sleep(HEARTBEAT_INTERVAL_MS);
		}
	}

	private async refreshBalances(module: ReturnType<typeof getModuleForBank>): Promise<void> {
		if (!this.dashboardPage) return;

		for (const account of this.state.accounts) {
			try {
				const balance = await module.getBalances(
					this.dashboardPage,
					account,
				);
				await this.stream.send({
					type: "balance_update",
					accountId: account.id,
					...balance,
				});
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(
					`[Seat ${this.state.seatId}] Balance refresh error for ${account.id}: ${msg}`,
				);
			}
		}
	}

	private async refreshTransactions(module: ReturnType<typeof getModuleForBank>): Promise<void> {
		if (!this.dashboardPage) return;

		for (const account of this.state.accounts) {
			try {
				const txData = await module.getTransactions(
					this.dashboardPage,
					account,
				);
				await this.stream.send({
					type: "transactions_update",
					accountId: account.id,
					transactions: txData,
				});
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(
					`[Seat ${this.state.seatId}] Transaction refresh error for ${account.id}: ${msg}`,
				);
			}
		}
	}

	async stop(): Promise<void> {
		console.log(`[Seat ${this.state.seatId}] Stopping`);
		this.running = false;
		this.state.status = "stopped";

		if (this.browserInstance) {
			try {
				await this.browserInstance.close();
			} catch {
				// browser may already be closed
			}
			this.browserInstance = null;
			this.dashboardPage = null;
		}

		await this.sendSessionUpdate("logged_out").catch(() => {});
	}

	updateCredentials(creds: SeatCredentials): void {
		this.state.credentials = creds;
	}

	private async sendSessionUpdate(
		status: "logging_in" | "2fa_pending" | "active" | "error" | "expired" | "logged_out",
		errorMessage?: string,
	): Promise<void> {
		await this.stream.send({
			type: "session_update",
			seatId: this.state.seatId,
			status,
			...(errorMessage && { errorMessage }),
		});
	}

	private scheduleRetry(): void {
		if (!this.running) return;

		const delay = randomBetween(10_000, 30_000);
		console.log(
			`[Seat ${this.state.seatId}] Scheduling retry in ${Math.round(delay / 1000)}s`,
		);

		setTimeout(async () => {
			if (!this.running) return;

			if (this.browserInstance) {
				try {
					await this.browserInstance.close();
				} catch {
					// ignore
				}
				this.browserInstance = null;
				this.dashboardPage = null;
			}

			await this.start();
		}, delay);
	}
}
