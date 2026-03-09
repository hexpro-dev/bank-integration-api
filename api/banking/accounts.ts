import { api, APIError, Query } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { orm } from "../lib/db.js";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import {
	seats,
	accounts,
	balances,
	transactions,
} from "@hex-pro/bank-integration-database/schema";

// --- Request / Response Types ---

interface ListAccountsRequest {
	seatId: string;
}

interface AccountItem {
	id: string;
	seatId: string;
	accountName: string;
	accountNumber: string;
	bsb: string | null;
	accountType: string | null;
	isTracked: boolean;
	createdAt: string;
	updatedAt: string;
}

interface ListAccountsResponse {
	accounts: AccountItem[];
}

interface GetBalancesRequest {
	id: string;
	limit?: Query<number>;
	since?: Query<string>;
}

interface BalanceItem {
	id: string;
	accountId: string;
	available: string;
	current: string;
	recordedAt: string;
	createdAt: string;
}

interface GetBalancesResponse {
	balances: BalanceItem[];
}

interface GetTransactionsRequest {
	id: string;
	limit?: Query<number>;
	since?: Query<string>;
	until?: Query<string>;
	type?: Query<string>;
}

interface TransactionItem {
	id: string;
	accountId: string;
	transactionDate: string;
	description: string;
	amount: string;
	balance: string | null;
	category: string | null;
	reference: string | null;
	transactionType: string;
	externalId: string | null;
	createdAt: string;
}

interface GetTransactionsResponse {
	transactions: TransactionItem[];
}

interface RefreshAccountRequest {
	id: string;
}

interface RefreshAccountResponse {
	status: string;
}

// --- Helpers ---

function requireUser(): string {
	const auth = getAuthData();
	if (!auth) throw APIError.unauthenticated("not authenticated");
	return auth.userID;
}

async function verifyAccountOwnership(
	accountId: string,
	userId: string,
): Promise<{ id: string; seatId: string }> {
	const [row] = await orm
		.select({
			id: accounts.id,
			seatId: accounts.seatId,
			seatUserId: seats.userId,
		})
		.from(accounts)
		.innerJoin(seats, eq(accounts.seatId, seats.id))
		.where(and(eq(accounts.id, accountId), eq(seats.userId, userId)))
		.limit(1);

	if (!row) throw APIError.notFound("account not found");
	return { id: row.id, seatId: row.seatId };
}

// --- Endpoints ---

export const listAccounts = api(
	{ method: "GET", path: "/v1/seats/:seatId/accounts", expose: true, auth: true },
	async (req: ListAccountsRequest): Promise<ListAccountsResponse> => {
		const userId = requireUser();

		const [seat] = await orm
			.select({ id: seats.id })
			.from(seats)
			.where(and(eq(seats.id, req.seatId), eq(seats.userId, userId)))
			.limit(1);

		if (!seat) throw APIError.notFound("seat not found");

		const rows = await orm
			.select()
			.from(accounts)
			.where(eq(accounts.seatId, req.seatId));

		return {
			accounts: rows.map((r) => ({
				id: r.id,
				seatId: r.seatId,
				accountName: r.accountName,
				accountNumber: r.accountNumber,
				bsb: r.bsb,
				accountType: r.accountType,
				isTracked: r.isTracked,
				createdAt: r.createdAt.toISOString(),
				updatedAt: r.updatedAt.toISOString(),
			})),
		};
	},
);

export const getBalances = api(
	{ method: "GET", path: "/v1/accounts/:id/balances", expose: true, auth: true },
	async (req: GetBalancesRequest): Promise<GetBalancesResponse> => {
		const userId = requireUser();
		await verifyAccountOwnership(req.id, userId);

		const conditions = [eq(balances.accountId, req.id)];

		if (req.since) {
			conditions.push(gte(balances.recordedAt, new Date(req.since)));
		}

		const queryLimit = req.limit ?? 100;

		const rows = await orm
			.select()
			.from(balances)
			.where(and(...conditions))
			.orderBy(desc(balances.recordedAt))
			.limit(queryLimit);

		return {
			balances: rows.map((r) => ({
				id: r.id,
				accountId: r.accountId,
				available: r.available,
				current: r.current,
				recordedAt: r.recordedAt.toISOString(),
				createdAt: r.createdAt.toISOString(),
			})),
		};
	},
);

export const getTransactions = api(
	{ method: "GET", path: "/v1/accounts/:id/transactions", expose: true, auth: true },
	async (req: GetTransactionsRequest): Promise<GetTransactionsResponse> => {
		const userId = requireUser();
		await verifyAccountOwnership(req.id, userId);

		const conditions = [eq(transactions.accountId, req.id)];

		if (req.since) {
			conditions.push(gte(transactions.transactionDate, req.since));
		}
		if (req.until) {
			conditions.push(lte(transactions.transactionDate, req.until));
		}
		if (req.type) {
			const txType = req.type as "debit" | "credit";
			conditions.push(eq(transactions.transactionType, txType));
		}

		const queryLimit = req.limit ?? 100;

		const rows = await orm
			.select()
			.from(transactions)
			.where(and(...conditions))
			.orderBy(desc(transactions.transactionDate))
			.limit(queryLimit);

		return {
			transactions: rows.map((r) => ({
				id: r.id,
				accountId: r.accountId,
				transactionDate: r.transactionDate,
				description: r.description,
				amount: r.amount,
				balance: r.balance,
				category: r.category,
				reference: r.reference,
				transactionType: r.transactionType,
				externalId: r.externalId,
				createdAt: r.createdAt.toISOString(),
			})),
		};
	},
);

export const refreshAccount = api(
	{ method: "POST", path: "/v1/accounts/:id/refresh", expose: true, auth: true },
	async (req: RefreshAccountRequest): Promise<RefreshAccountResponse> => {
		const userId = requireUser();
		const account = await verifyAccountOwnership(req.id, userId);

		try {
			const { sendRefreshRequest } = await import("../observer/connections.js");
			sendRefreshRequest(account.seatId, req.id);
		} catch {
			// observer module not yet available
		}

		return { status: "refresh_requested" };
	},
);
