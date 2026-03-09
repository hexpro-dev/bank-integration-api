import type { SeatCredentials, AccountInfo } from "../types.js";

export interface SeatManagerState {
	seatId: string;
	credentials: SeatCredentials;
	status:
		| "idle"
		| "logging_in"
		| "2fa_pending"
		| "active"
		| "error"
		| "stopped";
	accounts: AccountInfo[];
	lastBalanceRefresh: number;
	lastTransactionRefresh: number;
}
