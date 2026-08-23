/**
 * Who acts, and what they are allowed to do.
 *
 * Capabilities are rows, not a role column, because the interesting rule is
 * not "editors may publish" but "no automated identity may publish, ever,
 * however it was configured". That is a trigger on this table (see the custom
 * migration), and it is the reason `is_automated` lives here rather than being
 * inferred from a naming convention.
 */

import { relations } from "drizzle-orm";
import { boolean, index, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, nonBlank, primaryId, tsCol } from "./_shared";

export const appUser = pgTable(
  "app_user",
  {
    id: primaryId(),
    /** Subject id from the identity provider. Stable across email changes. */
    externalId: text("external_id").notNull().unique(),
    email: text("email").unique(),
    displayName: text("display_name").notNull(),
    /** Service accounts, connectors, workflow runners. Never publishers. */
    isAutomated: boolean("is_automated").notNull().default(false),
    disabledAt: tsCol("disabled_at"),
    createdAt: createdAt(),
  },
  (t) => [nonBlank(t.displayName, "app_user_display_name_is_named")],
);

export const capabilityGrant = pgTable(
  "capability_grant",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    capability: text("capability").notNull(),
    grantedBy: uuid("granted_by").references(() => appUser.id),
    grantedAt: createdAt(),
    /** Why this person holds this. Read during access reviews. */
    rationale: text("rationale").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.capability] }),
    index("capability_grant_by_capability").on(t.capability),
    nonBlank(t.rationale, "capability_grant_states_why"),
  ],
);

export const appUserRelations = relations(appUser, ({ many }) => ({
  capabilities: many(capabilityGrant),
}));

export const capabilityGrantRelations = relations(capabilityGrant, ({ one }) => ({
  user: one(appUser, { fields: [capabilityGrant.userId], references: [appUser.id] }),
  grantedByUser: one(appUser, { fields: [capabilityGrant.grantedBy], references: [appUser.id] }),
}));

export type AppUser = typeof appUser.$inferSelect;
export type NewAppUser = typeof appUser.$inferInsert;
