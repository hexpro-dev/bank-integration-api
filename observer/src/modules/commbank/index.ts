import { BankModule, NotImplementedError } from "../base.js";
import type { Page, SeatCredentials, AccountInfo, DiscoveredAccount, BalanceData, TransactionData, LoginResult } from "../types.js";

export class CommBankModule extends BankModule {
	readonly bankName = "commbank";
	readonly loginUrl = "https://www.my.commbank.com.au/netbank/Logon/Logon.aspx";

	async login(_page: Page, _credentials: SeatCredentials): Promise<LoginResult> {
		throw new NotImplementedError("CommBank", "login");
	}

	async handle2FA(_page: Page, _code: string): Promise<boolean> {
		throw new NotImplementedError("CommBank", "handle2FA");
	}

	async detect2FAType(_page: Page): Promise<"sms" | "app" | null> {
		throw new NotImplementedError("CommBank", "detect2FAType");
	}

	async capture2FAScreenshot(_page: Page): Promise<Buffer> {
		throw new NotImplementedError("CommBank", "capture2FAScreenshot");
	}

	async getAccounts(_page: Page): Promise<DiscoveredAccount[]> {
		throw new NotImplementedError("CommBank", "getAccounts");
	}

	async getBalances(_page: Page, _account: AccountInfo): Promise<BalanceData> {
		throw new NotImplementedError("CommBank", "getBalances");
	}

	async getTransactions(_page: Page, _account: AccountInfo): Promise<TransactionData[]> {
		throw new NotImplementedError("CommBank", "getTransactions");
	}

	async isSessionValid(_page: Page): Promise<boolean> {
		throw new NotImplementedError("CommBank", "isSessionValid");
	}

	async navigateToDashboard(_page: Page): Promise<void> {
		throw new NotImplementedError("CommBank", "navigateToDashboard");
	}
}
