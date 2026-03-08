CREATE TABLE IF NOT EXISTS "drink_events" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "event_type" text NOT NULL,
  "user_id" varchar,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drink_events" ADD CONSTRAINT "drink_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drink_events_slug_idx" ON "drink_events" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drink_events_created_at_idx" ON "drink_events" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drink_events_event_type_idx" ON "drink_events" USING btree ("event_type");
