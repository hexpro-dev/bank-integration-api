import { BankModule, NotImplementedError } from "../base.js";
import type { Page, SeatCredentials, AccountInfo, DiscoveredAccount, BalanceData, TransactionData, LoginResult } from "../types.js";

export class WestpacModule extends BankModule {
	readonly bankName = "westpac";
	readonly loginUrl = "https://banking.westpac.com.au/secure/banking/reauth/0,,,00.html";

	async login(_page: Page, _credentials: SeatCredentials): Promise<LoginResult> {
		throw new NotImplementedError("Westpac", "login");
	}

	async handle2FA(_page: Page, _code: string): Promise<boolean> {
		throw new NotImplementedError("Westpac", "handle2FA");
	}

	async detect2FAType(_page: Page): Promise<"sms" | "app" | null> {
		throw new NotImplementedError("Westpac", "detect2FAType");
	}

	async capture2FAScreenshot(_page: Page): Promise<Buffer> {
		throw new NotImplementedError("Westpac", "capture2FAScreenshot");
	}

	async getAccounts(_page: Page): Promise<DiscoveredAccount[]> {
		throw new NotImplementedError("Westpac", "getAccounts");
	}

	async getBalances(_page: Page, _account: AccountInfo): Promise<BalanceData> {
		throw new NotImplementedError("Westpac", "getBalances");
	}

	async getTransactions(_page: Page, _account: AccountInfo): Promise<TransactionData[]> {
		throw new NotImplementedError("Westpac", "getTransactions");
	}

	async isSessionValid(_page: Page): Promise<boolean> {
		throw new NotImplementedError("Westpac", "isSessionValid");
	}

	async navigateToDashboard(_page: Page): Promise<void> {
		throw new NotImplementedError("Westpac", "navigateToDashboard");
	}
}
