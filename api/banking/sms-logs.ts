import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { orm } from "../lib/db.js";
import { eq, desc, sql, inArray } from "drizzle-orm";
import {
	seats,
	smsWebhookLogs,
} from "@hex-pro/bank-integration-database/schema";

interface ListSmsLogsRequest {
	seatId?: string;
	limit?: number;
	offset?: number;
}

interface SmsLogItem {
	id: string;
	seatId: string;
	seatBank: string | null;
	seatLabel: string | null;
	fromNumber: string | null;
	messageBody: string | null;
	rawBody: string;
	contentType: string | null;
	extractedCode: string | null;
	receivedAt: string;
}

interface ListSmsLogsResponse {
	logs: SmsLogItem[];
	total: number;
}

function requireUser(): string {
	const auth = getAuthData();
	if (!auth) throw APIError.unauthenticated("not authenticated");
	return auth.userID;
}

export const listSmsLogs = api(
	{ method: "GET", path: "/v1/sms-logs", expose: true, auth: true },
	async (req: ListSmsLogsRequest): Promise<ListSmsLogsResponse> => {
		const userId = requireUser();

		const limit = Math.min(Math.max(req.limit ?? 50, 1), 200);
		const offset = Math.max(req.offset ?? 0, 0);

		const userSeats = await orm
			.select({ id: seats.id })
			.from(seats)
			.where(eq(seats.userId, userId));

		const seatIds = userSeats.map((s) => s.id);

		if (seatIds.length === 0) {
			return { logs: [], total: 0 };
		}

		const filterSeatIds =
			req.seatId && seatIds.includes(req.seatId)
				? [req.seatId]
				: req.seatId
					? []
					: seatIds;

		if (filterSeatIds.length === 0) {
			return { logs: [], total: 0 };
		}

		const condition = inArray(
			sql`${smsWebhookLogs.seatId}::uuid`,
			filterSeatIds,
		);

		const [countResult] = await orm
			.select({ count: sql<number>`count(*)::int` })
			.from(smsWebhookLogs)
			.where(condition);

		const rows = await orm
			.select({
				id: smsWebhookLogs.id,
				seatId: smsWebhookLogs.seatId,
				seatBank: seats.bank,
				seatLabel: seats.label,
				fromNumber: smsWebhookLogs.fromNumber,
				messageBody: smsWebhookLogs.messageBody,
				rawBody: smsWebhookLogs.rawBody,
				contentType: smsWebhookLogs.contentType,
				extractedCode: smsWebhookLogs.extractedCode,
				receivedAt: smsWebhookLogs.receivedAt,
			})
			.from(smsWebhookLogs)
			.innerJoin(seats, sql`${smsWebhookLogs.seatId}::uuid = ${seats.id}`)
			.where(condition)
			.orderBy(desc(smsWebhookLogs.receivedAt))
			.limit(limit)
			.offset(offset);

		return {
			logs: rows.map((r) => ({
				id: r.id,
				seatId: r.seatId,
				seatBank: r.seatBank,
				seatLabel: r.seatLabel,
				fromNumber: r.fromNumber,
				messageBody: r.messageBody,
				rawBody: r.rawBody,
				contentType: r.contentType,
				extractedCode: r.extractedCode,
				receivedAt: r.receivedAt.toISOString(),
			})),
			total: countResult?.count ?? 0,
		};
	},
);
