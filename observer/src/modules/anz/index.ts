import { BankModule, NotImplementedError } from "../base.js";
import type { Page, SeatCredentials, AccountInfo, DiscoveredAccount, BalanceData, TransactionData, LoginResult } from "../types.js";

export class AnzModule extends BankModule {
	readonly bankName = "anz";
	readonly loginUrl = "https://www.anz.com.au/INETBANK/login.asp";

	async login(_page: Page, _credentials: SeatCredentials): Promise<LoginResult> {
		throw new NotImplementedError("ANZ", "login");
	}

	async handle2FA(_page: Page, _code: string): Promise<boolean> {
		throw new NotImplementedError("ANZ", "handle2FA");
	}

	async detect2FAType(_page: Page): Promise<"sms" | "app" | null> {
		throw new NotImplementedError("ANZ", "detect2FAType");
	}

	async capture2FAScreenshot(_page: Page): Promise<Buffer> {
		throw new NotImplementedError("ANZ", "capture2FAScreenshot");
	}

	async getAccounts(_page: Page): Promise<DiscoveredAccount[]> {
		throw new NotImplementedError("ANZ", "getAccounts");
	}

	async getBalances(_page: Page, _account: AccountInfo): Promise<BalanceData> {
		throw new NotImplementedError("ANZ", "getBalances");
	}

	async getTransactions(_page: Page, _account: AccountInfo): Promise<TransactionData[]> {
		throw new NotImplementedError("ANZ", "getTransactions");
	}

	async isSessionValid(_page: Page): Promise<boolean> {
		throw new NotImplementedError("ANZ", "isSessionValid");
	}

	async navigateToDashboard(_page: Page): Promise<void> {
		throw new NotImplementedError("ANZ", "navigateToDashboard");
	}
}
