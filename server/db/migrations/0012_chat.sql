CREATE TABLE "chat_citation" (
	"message_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"quote" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_citation_message_id_document_id_pk" PRIMARY KEY("message_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"seq" integer DEFAULT 0 NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"ai_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_message_role_is_known" CHECK ("chat_message"."role" IN ('user', 'assistant', 'system')),
	CONSTRAINT "chat_message_seq_is_positive" CHECK ("chat_message"."seq" >= 1),
	CONSTRAINT "assistant_message_names_its_run" CHECK ("chat_message"."role" <> 'assistant' OR "chat_message"."ai_run_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "chat_thread" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"created_by" uuid,
	"created_by_label" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_thread_names_its_creator" CHECK (length(btrim("chat_thread"."created_by_label")) > 0)
);
--> statement-breakpoint
CREATE TABLE "chat_tool_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"message_id" uuid,
	"tool" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"result_document_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_tool_run_names_a_tool" CHECK (length(btrim("chat_tool_run"."tool")) > 0),
	CONSTRAINT "chat_tool_run_status_is_known" CHECK ("chat_tool_run"."status" IN ('ok', 'error'))
);
--> statement-breakpoint
ALTER TABLE "chat_citation" ADD CONSTRAINT "chat_citation_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_citation" ADD CONSTRAINT "chat_citation_document_id_search_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."search_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_thread_id_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_ai_run_id_ai_run_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_thread" ADD CONSTRAINT "chat_thread_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_tool_run" ADD CONSTRAINT "chat_tool_run_thread_id_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_tool_run" ADD CONSTRAINT "chat_tool_run_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_citation_by_document" ON "chat_citation" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_message_is_sequential" ON "chat_message" USING btree ("thread_id","seq");--> statement-breakpoint
CREATE INDEX "chat_thread_by_creator" ON "chat_thread" USING btree ("created_by","created_at");--> statement-breakpoint
CREATE INDEX "chat_tool_run_by_thread" ON "chat_tool_run" USING btree ("thread_id","created_at");