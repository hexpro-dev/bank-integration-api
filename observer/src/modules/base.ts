import type { Page, SeatCredentials, AccountInfo, DiscoveredAccount, BalanceData, TransactionData, LoginResult } from "./types.js";

export class NotImplementedError extends Error {
	constructor(bankName: string, methodName: string) {
		super(`${bankName} module: ${methodName}() is not yet implemented`);
		this.name = "NotImplementedError";
	}
}

export abstract class BankModule {
	abstract readonly bankName: string;
	abstract readonly loginUrl: string;

	abstract login(page: Page, credentials: SeatCredentials): Promise<LoginResult>;
	abstract handle2FA(page: Page, code: string): Promise<boolean>;
	abstract detect2FAType(page: Page): Promise<"sms" | "app" | null>;
	abstract capture2FAScreenshot(page: Page): Promise<Buffer>;
	abstract getAccounts(page: Page): Promise<DiscoveredAccount[]>;
	abstract getBalances(page: Page, account: AccountInfo): Promise<BalanceData>;
	abstract getTransactions(page: Page, account: AccountInfo): Promise<TransactionData[]>;
	abstract isSessionValid(page: Page): Promise<boolean>;
	abstract navigateToDashboard(page: Page): Promise<void>;
}
