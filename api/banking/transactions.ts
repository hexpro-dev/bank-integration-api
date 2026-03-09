import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { orm } from "../lib/db.js";
import { eq, desc, inArray } from "drizzle-orm";
import {
	seats,
	accounts,
	transactions,
} from "@hex-pro/bank-integration-database/schema";

// --- Types ---

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

interface RecentTransactionsResponse {
	transactions: TransactionItem[];
}

// --- Endpoint ---

export const recentTransactions = api(
	{ method: "GET", path: "/v1/transactions/recent", expose: true, auth: true },
	async (): Promise<RecentTransactionsResponse> => {
		const auth = getAuthData();
		if (!auth) throw APIError.unauthenticated("not authenticated");

		const userSeats = await orm
			.select({ id: seats.id })
			.from(seats)
			.where(eq(seats.userId, auth.userID));

		if (userSeats.length === 0) {
			return { transactions: [] };
		}

		const seatIds = userSeats.map((s) => s.id);

		const userAccounts = await orm
			.select({ id: accounts.id })
			.from(accounts)
			.where(inArray(accounts.seatId, seatIds));

		if (userAccounts.length === 0) {
			return { transactions: [] };
		}

		const accountIds = userAccounts.map((a) => a.id);

		const rows = await orm
			.select()
			.from(transactions)
			.where(inArray(transactions.accountId, accountIds))
			.orderBy(desc(transactions.transactionDate))
			.limit(50);

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
