export type Bank = "anz" | "commbank" | "nab" | "westpac";

export interface SeatCredentials {
	id: string;
	bank: Bank;
	username: string;
	password: string;
	isActive: boolean;
	twoFactorConfig?: TwoFactorConfig | null;
	accountScopes?: AccountScope[];
}

export interface TwoFactorConfig {
	method: "sms" | "app";
	smsProvider?: string;
	smsPhoneNumber?: string;
	notificationEmail?: string;
}

export interface AccountScope {
	identifier: string;
	identifierType: "name" | "number";
}

export interface DiscoveredAccount {
	accountName: string;
	accountNumber: string;
	bsb?: string;
	accountType?: string;
}

export interface AccountInfo {
	id: string;
	accountName: string;
	accountNumber: string;
	bsb?: string;
	accountType?: string;
}

export interface BalanceData {
	available: string;
	current: string;
	recordedAt: string;
}

export interface TransactionData {
	transactionDate: string;
	description: string;
	amount: string;
	balance?: string;
	category?: string;
	reference?: string;
	transactionType: "debit" | "credit";
	externalId?: string;
}

export type LoginResultStatus = "success" | "2fa_required" | "failed";

export interface LoginResult {
	status: LoginResultStatus;
	twoFactorType?: "sms" | "app" | null;
	errorMessage?: string;
}

// Stream message types (observer -> API)
export interface SessionUpdateMsg {
	type: "session_update";
	seatId: string;
	status: "logging_in" | "2fa_pending" | "active" | "error" | "expired" | "logged_out";
	errorMessage?: string;
}

export interface BalanceUpdateMsg {
	type: "balance_update";
	accountId: string;
	available: string;
	current: string;
	recordedAt: string;
}

export interface TransactionsUpdateMsg {
	type: "transactions_update";
	accountId: string;
	transactions: TransactionData[];
}

export interface AccountsDiscoveredMsg {
	type: "accounts_discovered";
	seatId: string;
	accounts: DiscoveredAccount[];
}

export interface HeartbeatMsg {
	type: "heartbeat";
	timestamp: string;
	activeSeatsCount: number;
}

export interface ScreenshotMsg {
	type: "screenshot";
	seatId: string;
	imageBase64: string;
}

export type ObserverOutMessage =
	| SessionUpdateMsg
	| BalanceUpdateMsg
	| TransactionsUpdateMsg
	| AccountsDiscoveredMsg
	| HeartbeatMsg
	| ScreenshotMsg;

// Stream message types (API -> observer)
export interface ActiveSeatsMsg {
	type: "active_seats";
	seats: SeatCredentials[];
}

export interface TwoFactorCodeMsg {
	type: "2fa_code";
	seatId: string;
	code: string;
}

export interface RefreshRequestMsg {
	type: "refresh_request";
	seatId: string;
	accountId: string;
}

export interface SeatUpdatedMsg {
	type: "seat_updated";
	seat: {
		id: string;
		bank: string;
		username: string;
		password: string;
		isActive: boolean;
	};
}

export interface SeatDeletedMsg {
	type: "seat_deleted";
	seatId: string;
}

export interface SeatAddedMsg {
	type: "seat_added";
	seat: {
		id: string;
		bank: string;
		username: string;
		password: string;
		isActive: boolean;
	};
}

export interface Seat2faUpdatedMsg {
	type: "seat_2fa_updated";
	seatId: string;
	config: {
		method: string;
		smsProvider?: string;
		smsPhoneNumber?: string;
	} | null;
}

export type ApiInMessage =
	| ActiveSeatsMsg
	| TwoFactorCodeMsg
	| RefreshRequestMsg
	| SeatUpdatedMsg
	| SeatDeletedMsg
	| SeatAddedMsg
	| Seat2faUpdatedMsg;
