import { BankModule, NotImplementedError } from "../base.js";
import type { Page, SeatCredentials, AccountInfo, DiscoveredAccount, BalanceData, TransactionData, LoginResult } from "../types.js";

export class NabModule extends BankModule {
	readonly bankName = "nab";
	readonly loginUrl = "https://ib.nab.com.au/nabib/index.jsp";

	async login(_page: Page, _credentials: SeatCredentials): Promise<LoginResult> {
		throw new NotImplementedError("NAB", "login");
	}

	async handle2FA(_page: Page, _code: string): Promise<boolean> {
		throw new NotImplementedError("NAB", "handle2FA");
	}

	async detect2FAType(_page: Page): Promise<"sms" | "app" | null> {
		throw new NotImplementedError("NAB", "detect2FAType");
	}

	async capture2FAScreenshot(_page: Page): Promise<Buffer> {
		throw new NotImplementedError("NAB", "capture2FAScreenshot");
	}

	async getAccounts(_page: Page): Promise<DiscoveredAccount[]> {
		throw new NotImplementedError("NAB", "getAccounts");
	}

	async getBalances(_page: Page, _account: AccountInfo): Promise<BalanceData> {
		throw new NotImplementedError("NAB", "getBalances");
	}

	async getTransactions(_page: Page, _account: AccountInfo): Promise<TransactionData[]> {
		throw new NotImplementedError("NAB", "getTransactions");
	}

	async isSessionValid(_page: Page): Promise<boolean> {
		throw new NotImplementedError("NAB", "isSessionValid");
	}

	async navigateToDashboard(_page: Page): Promise<void> {
		throw new NotImplementedError("NAB", "navigateToDashboard");
	}
}
