-- Media and homepage tables already exist from migrations 0054 and 0057.
ALTER TYPE "public"."publication_section" ADD VALUE 'news';--> statement-breakpoint
ALTER TYPE "public"."publication_section" ADD VALUE 'influence_investigation';--> statement-breakpoint
ALTER TYPE "public"."publication_section" ADD VALUE 'antisemitism';--> statement-breakpoint
ALTER TYPE "public"."publication_section" ADD VALUE 'innovation';--> statement-breakpoint
ALTER TYPE "public"."publication_section" ADD VALUE 'science_medicine';--> statement-breakpoint
ALTER TYPE "public"."publication_section" ADD VALUE 'technology_ai';--> statement-breakpoint
ALTER TYPE "public"."publication_section" ADD VALUE 'achievement';--> statement-breakpoint
ALTER TYPE "public"."publication_section" ADD VALUE 'international_cooperation';--> statement-breakpoint
ALTER TYPE "public"."publication_section" ADD VALUE 'people';--> statement-breakpoint
ALTER TYPE "public"."publication_section" ADD VALUE 'courage_service';--> statement-breakpoint
ALTER TYPE "public"."publication_section" ADD VALUE 'history_context';
