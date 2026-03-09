export interface User {
	id: string;
	email: string;
	passwordHash: string;
	name: string;
	role: "admin" | "user";
	isFirstUser: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewUser {
	id?: string;
	email: string;
	passwordHash: string;
	name: string;
	role?: "admin" | "user";
	isFirstUser?: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}

export type Bank = "anz" | "commbank" | "nab" | "westpac";

export interface Seat {
	id: string;
	userId: string;
	bank: Bank;
	encryptedUsername: string;
	encryptedPassword: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewSeat {
	id?: string;
	userId: string;
	bank: Bank;
	encryptedUsername: string;
	encryptedPassword: string;
	isActive?: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}

export type TwoFactorMethod = "sms" | "app";
export type SmsProvider = "twilio" | "plivo";

export interface Seat2faConfig {
	id: string;
	seatId: string;
	method: TwoFactorMethod;
	smsProvider: SmsProvider | null;
	encryptedSmsApiKey: string | null;
	encryptedSmsApiSecret: string | null;
	smsPhoneNumber: string | null;
	smsForwardTo: string | null;
	notificationEmail: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewSeat2faConfig {
	id?: string;
	seatId: string;
	method: TwoFactorMethod;
	smsProvider?: SmsProvider | null;
	encryptedSmsApiKey?: string | null;
	encryptedSmsApiSecret?: string | null;
	smsPhoneNumber?: string | null;
	smsForwardTo?: string | null;
	notificationEmail?: string | null;
	createdAt?: Date;
	updatedAt?: Date;
}

export type IdentifierType = "name" | "number";

export interface SeatAccountScope {
	id: string;
	seatId: string;
	identifier: string;
	identifierType: IdentifierType;
}

export interface NewSeatAccountScope {
	id?: string;
	seatId: string;
	identifier: string;
	identifierType: IdentifierType;
}

export interface Account {
	id: string;
	seatId: string;
	accountName: string;
	accountNumber: string;
	bsb: string | null;
	accountType: string | null;
	isTracked: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewAccount {
	id?: string;
	seatId: string;
	accountName: string;
	accountNumber: string;
	bsb?: string | null;
	accountType?: string | null;
	isTracked?: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface Balance {
	id: string;
	accountId: string;
	available: string;
	current: string;
	recordedAt: Date;
	createdAt: Date;
}

export interface NewBalance {
	id?: string;
	accountId: string;
	available: string;
	current: string;
	recordedAt: Date;
	createdAt?: Date;
}

export type TransactionType = "debit" | "credit";

export interface Transaction {
	id: string;
	accountId: string;
	transactionDate: string;
	description: string;
	amount: string;
	balance: string | null;
	category: string | null;
	reference: string | null;
	transactionType: TransactionType;
	externalId: string | null;
	createdAt: Date;
}

export interface NewTransaction {
	id?: string;
	accountId: string;
	transactionDate: string;
	description: string;
	amount: string;
	balance?: string | null;
	category?: string | null;
	reference?: string | null;
	transactionType: TransactionType;
	externalId?: string | null;
	createdAt?: Date;
}

export interface TwoFactorCode {
	id: string;
	seatId: string;
	code: string;
	source: string | null;
	receivedAt: Date;
	used: boolean;
	createdAt: Date;
}

export interface NewTwoFactorCode {
	id?: string;
	seatId: string;
	code: string;
	source?: string | null;
	receivedAt: Date;
	used?: boolean;
	createdAt?: Date;
}

export interface ApiToken {
	id: string;
	userId: string;
	name: string;
	tokenHash: string;
	scopes: string[];
	lastUsedAt: Date | null;
	expiresAt: Date | null;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewApiToken {
	id?: string;
	userId: string;
	name: string;
	tokenHash: string;
	scopes?: string[];
	lastUsedAt?: Date | null;
	expiresAt?: Date | null;
	isActive?: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface UserWebhook {
	id: string;
	userId: string;
	url: string;
	events: string[];
	secret: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewUserWebhook {
	id?: string;
	userId: string;
	url: string;
	events: string[];
	secret: string;
	isActive?: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface SmsWebhookLog {
	id: string;
	seatId: string;
	fromNumber: string | null;
	messageBody: string | null;
	rawBody: string;
	contentType: string | null;
	extractedCode: string | null;
	receivedAt: Date;
	createdAt: Date;
}

export interface NewSmsWebhookLog {
	id?: string;
	seatId: string;
	fromNumber?: string | null;
	messageBody?: string | null;
	rawBody: string;
	contentType?: string | null;
	extractedCode?: string | null;
	receivedAt: Date;
	createdAt?: Date;
}

export type SessionStatus =
	| "logging_in"
	| "2fa_pending"
	| "active"
	| "error"
	| "expired"
	| "logged_out";

export interface ObserverSession {
	id: string;
	seatId: string;
	status: SessionStatus;
	screenshotUrl: string | null;
	errorMessage: string | null;
	startedAt: Date;
	lastActivityAt: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewObserverSession {
	id?: string;
	seatId: string;
	status: SessionStatus;
	screenshotUrl?: string | null;
	errorMessage?: string | null;
	startedAt?: Date;
	lastActivityAt?: Date;
	createdAt?: Date;
	updatedAt?: Date;
}
