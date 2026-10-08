import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "user"]);
export const accountGroup = pgEnum("account_group", [
  "ativo",
  "passivo",
  "patrimonio_liquido",
  "despesa",
  "receita",
  "apuracao",
]);
export const nature = pgEnum("nature", ["D", "C"]);
export const entrySide = pgEnum("entry_side", ["D", "C"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

/** Perfil da aplicação, 1:1 com auth.users (id igual). */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: userRole("role").notNull().default("user"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
}).enableRLS();

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  legalName: text("legal_name").notNull(),
  cnpj: text("cnpj").notNull().unique(),
  ...timestamps,
}).enableRLS();

/** Natureza e numeração inicial de cada grupo de contas, por empresa. */
export const accountGroupSettings = pgTable(
  "account_group_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    group: accountGroup("group").notNull(),
    nature: nature("nature"),
    prefix: text("prefix").notNull(),
  },
  (t) => [uniqueIndex("account_group_settings_company_group").on(t.companyId, t.group)],
).enableRLS();

export const dreCategories = pgTable(
  "dre_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("dre_categories_company").on(t.companyId)],
).enableRLS();

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    reducedCode: integer("reduced_code").notNull(),
    classification: text("classification").notNull(),
    name: text("name").notNull(),
    dreCategoryId: uuid("dre_category_id").references(() => dreCategories.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("accounts_company_classification").on(t.companyId, t.classification),
    uniqueIndex("accounts_company_reduced").on(t.companyId, t.reducedCode),
  ],
).enableRLS();

/** Parâmetros de zeramento (encerramento das contas de resultado). */
export const closingSettings = pgTable("closing_settings", {
  companyId: uuid("company_id")
    .primaryKey()
    .references(() => companies.id, { onDelete: "cascade" }),
  resultAccountId: uuid("result_account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  profitAccountId: uuid("profit_account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  lossAccountId: uuid("loss_account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  ...timestamps,
}).enableRLS();

export const closingBatches = pgTable("closing_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  netResult: numeric("net_result", { precision: 18, scale: 2 }).notNull(),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const historyCodes = pgTable(
  "history_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    code: integer("code").notNull(),
    description: text("description").notNull(),
  },
  (t) => [uniqueIndex("history_codes_company_code").on(t.companyId, t.code)],
).enableRLS();

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    date: date("date").notNull(),
    historyCode: integer("history_code"),
    description: text("description").notNull(),
    closingBatchId: uuid("closing_batch_id").references(() => closingBatches.id, {
      onDelete: "cascade",
    }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("journal_entries_company_number").on(t.companyId, t.number),
    index("journal_entries_company_date").on(t.companyId, t.date),
  ],
).enableRLS();

export const journalLines = pgTable(
  "journal_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    side: entrySide("side").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("journal_lines_entry").on(t.entryId), index("journal_lines_account").on(t.accountId)],
).enableRLS();

export const explanatoryNotes = pgTable("explanatory_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
  ...timestamps,
}).enableRLS();

export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull(),
  ...timestamps,
}).enableRLS();

export const budgetItems = pgTable(
  "budget_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  },
  (t) => [uniqueIndex("budget_items_budget_account").on(t.budgetId, t.accountId)],
).enableRLS();

/** Códigos de verificação em dois fatores enviados por e-mail. */
export const mfaChallenges = pgTable(
  "mfa_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    sessionId: text("session_id").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("mfa_challenges_session").on(t.sessionId)],
).enableRLS();

export const accountsRelations = relations(accounts, ({ one }) => ({
  dreCategory: one(dreCategories, {
    fields: [accounts.dreCategoryId],
    references: [dreCategories.id],
  }),
}));

export const journalEntriesRelations = relations(journalEntries, ({ many }) => ({
  lines: many(journalLines),
}));

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  entry: one(journalEntries, { fields: [journalLines.entryId], references: [journalEntries.id] }),
  account: one(accounts, { fields: [journalLines.accountId], references: [accounts.id] }),
}));

export const budgetsRelations = relations(budgets, ({ many }) => ({
  items: many(budgetItems),
}));

export const budgetItemsRelations = relations(budgetItems, ({ one }) => ({
  budget: one(budgets, { fields: [budgetItems.budgetId], references: [budgets.id] }),
  account: one(accounts, { fields: [budgetItems.accountId], references: [accounts.id] }),
}));

export type AccountGroup = (typeof accountGroup.enumValues)[number];
export type Nature = (typeof nature.enumValues)[number];
