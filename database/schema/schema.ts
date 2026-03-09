import {
	pgTable,
	pgEnum,
	uuid,
	text,
	boolean,
	numeric,
	date,
	timestamp,
	index,
	unique,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);

export const bankEnum = pgEnum("bank", ["anz", "commbank", "nab", "westpac"]);

export const twoFactorMethodEnum = pgEnum("two_factor_method", ["sms", "app"]);

export const smsProviderEnum = pgEnum("sms_provider", ["twilio", "plivo"]);

export const identifierTypeEnum = pgEnum("identifier_type", ["name", "number"]);

export const transactionTypeEnum = pgEnum("transaction_type", [
	"debit",
	"credit",
]);

export const sessionStatusEnum = pgEnum("session_status", [
	"logging_in",
	"2fa_pending",
	"active",
	"error",
	"expired",
	"logged_out",
]);

export const users = pgTable("users", {
	id: uuid().primaryKey().defaultRandom(),
	email: text().unique().notNull(),
	passwordHash: text("password_hash").notNull(),
	name: text().notNull(),
	role: userRoleEnum().notNull().default("user"),
	isFirstUser: boolean("is_first_user").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const seats = pgTable(
	"seats",
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		bank: bankEnum().notNull(),
		label: text(),
		encryptedUsername: text("encrypted_username").notNull(),
		encryptedPassword: text("encrypted_password").notNull(),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("seats_user_id_idx").on(table.userId),
		index("seats_bank_active_idx").on(table.bank, table.isActive),
	],
);

export const seat2faConfigs = pgTable("seat_2fa_configs", {
	id: uuid().primaryKey().defaultRandom(),
	seatId: uuid("seat_id")
		.notNull()
		.unique()
		.references(() => seats.id, { onDelete: "cascade" }),
	method: twoFactorMethodEnum().notNull(),
	smsProvider: smsProviderEnum("sms_provider"),
	encryptedSmsApiKey: text("encrypted_sms_api_key"),
	encryptedSmsApiSecret: text("encrypted_sms_api_secret"),
	smsPhoneNumber: text("sms_phone_number"),
	smsForwardTo: text("sms_forward_to"),
	notificationEmail: text("notification_email"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const seatAccountScopes = pgTable(
	"seat_account_scopes",
	{
		id: uuid().primaryKey().defaultRandom(),
		seatId: uuid("seat_id")
			.notNull()
			.references(() => seats.id, { onDelete: "cascade" }),
		identifier: text().notNull(),
		identifierType: identifierTypeEnum("identifier_type").notNull(),
	},
	(table) => [
		index("seat_account_scopes_seat_id_idx").on(table.seatId),
	],
);

export const accounts = pgTable(
	"accounts",
	{
		id: uuid().primaryKey().defaultRandom(),
		seatId: uuid("seat_id")
			.notNull()
			.references(() => seats.id, { onDelete: "cascade" }),
		accountName: text("account_name").notNull(),
		accountNumber: text("account_number").notNull(),
		bsb: text(),
		accountType: text("account_type"),
		isTracked: boolean("is_tracked").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("accounts_seat_id_idx").on(table.seatId),
		index("accounts_account_number_idx").on(table.accountNumber),
	],
);

export const balances = pgTable(
	"balances",
	{
		id: uuid().primaryKey().defaultRandom(),
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		available: numeric().notNull(),
		current: numeric().notNull(),
		recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("balances_account_recorded_idx").on(
			table.accountId,
			table.recordedAt,
		),
	],
);

export const transactions = pgTable(
	"transactions",
	{
		id: uuid().primaryKey().defaultRandom(),
		accountId: uuid("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),
		transactionDate: date("transaction_date").notNull(),
		description: text().notNull(),
		amount: numeric().notNull(),
		balance: numeric(),
		category: text(),
		reference: text(),
		transactionType: transactionTypeEnum("transaction_type").notNull(),
		externalId: text("external_id").unique(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("transactions_account_date_idx").on(
			table.accountId,
			table.transactionDate,
		),
		index("transactions_external_id_idx").on(table.externalId),
	],
);

export const twoFactorCodes = pgTable(
	"two_factor_codes",
	{
		id: uuid().primaryKey().defaultRandom(),
		seatId: uuid("seat_id")
			.notNull()
			.references(() => seats.id, { onDelete: "cascade" }),
		code: text().notNull(),
		source: text(),
		receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
		used: boolean().notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("two_factor_codes_seat_received_idx").on(
			table.seatId,
			table.receivedAt,
		),
	],
);

export const apiTokens = pgTable(
	"api_tokens",
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text().notNull(),
		tokenHash: text("token_hash").unique().notNull(),
		scopes: text().array().notNull().default([]),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("api_tokens_token_hash_idx").on(table.tokenHash),
		index("api_tokens_user_id_idx").on(table.userId),
	],
);

export const userWebhooks = pgTable(
	"user_webhooks",
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		url: text().notNull(),
		events: text().array().notNull(),
		secret: text().notNull(),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [index("user_webhooks_user_id_idx").on(table.userId)],
);

export const smsWebhookLogs = pgTable(
	"sms_webhook_logs",
	{
		id: uuid().primaryKey().defaultRandom(),
		seatId: text("seat_id").notNull(),
		fromNumber: text("from_number"),
		messageBody: text("message_body"),
		rawBody: text("raw_body").notNull(),
		contentType: text("content_type"),
		extractedCode: text("extracted_code"),
		receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("sms_webhook_logs_seat_received_idx").on(
			table.seatId,
			table.receivedAt,
		),
	],
);

export const observerSessions = pgTable(
	"observer_sessions",
	{
		id: uuid().primaryKey().defaultRandom(),
		seatId: uuid("seat_id")
			.notNull()
			.references(() => seats.id, { onDelete: "cascade" }),
		status: sessionStatusEnum().notNull(),
		screenshotUrl: text("screenshot_url"),
		errorMessage: text("error_message"),
		startedAt: timestamp("started_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("observer_sessions_seat_status_idx").on(
			table.seatId,
			table.status,
		),
	],
);
