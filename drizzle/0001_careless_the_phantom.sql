CREATE TABLE "recruiter_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"company" text,
	"role" text,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recruiter_contact" ADD CONSTRAINT "recruiter_contact_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recruiter_contact_user_email_idx" ON "recruiter_contact" USING btree ("user_id","email_normalized");--> statement-breakpoint
CREATE INDEX "recruiter_contact_user_idx" ON "recruiter_contact" USING btree ("user_id");