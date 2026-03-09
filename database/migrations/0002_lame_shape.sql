CREATE TABLE "sms_webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seat_id" text NOT NULL,
	"from_number" text,
	"message_body" text,
	"raw_body" text NOT NULL,
	"content_type" text,
	"extracted_code" text,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sms_webhook_logs_seat_received_idx" ON "sms_webhook_logs" USING btree ("seat_id","received_at");