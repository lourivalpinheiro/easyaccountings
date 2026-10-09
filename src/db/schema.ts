import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
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
export const personType = pgEnum("person_type", ["PF", "PJ", "INF"]);
export const cashFlowType = pgEnum("cash_flow_type", ["entrada", "saida", "economia", "cartao_credito"]);
export const cashFlowFrequency = pgEnum("cash_flow_frequency", [
  "unica",
  "diaria",
  "semanal",
  "quinzenal",
  "mensal",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
]);
export const investmentKind = pgEnum("investment_kind", [
  "poupanca",
  "cdb",
  "lci_lca",
  "tesouro",
  "fundo",
  "acoes",
  "previdencia",
  "cripto",
  "outro",
]);
export const planSection = pgEnum("plan_section", ["diagnostico", "planejamento", "orcamentos", "controle", "cenarios"]);
export const nature = pgEnum("nature", ["D", "C"]);
export const entrySide = pgEnum("entry_side", ["D", "C"]);
export const reconciliationModule = pgEnum("reconciliation_module", ["contabil", "financeiro", "ambos"]);

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
  /** Caminho da foto no bucket "avatars" (não a URL pronta). */
  avatarPath: text("avatar_path"),
  /** Segredo TOTP (Base32) do app autenticador; nulo = ainda não configurou o segundo fator. */
  totpSecret: text("totp_secret"),
  /** Empresa que abre automaticamente ao entrar no sistema (se o usuário ainda tiver acesso a ela). */
  pinnedCompanyId: uuid("pinned_company_id").references((): AnyPgColumn => companies.id, { onDelete: "set null" }),
  ...timestamps,
}).enableRLS();

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  personType: personType("person_type").notNull().default("PJ"),
  /** Razão social (PJ) ou nome completo (PF). */
  legalName: text("legal_name").notNull(),
  /** Nome fantasia (PJ) ou apelido (PF); opcional, não se aplica a informais (INF). */
  displayName: text("display_name"),
  /** CNPJ (PJ) ou CPF (PF), somente dígitos; vazio para empresas informais (INF). */
  document: text("document").unique(),
  /** Código secreto do link público (somente leitura); nulo = empresa privada. */
  publicToken: text("public_token").unique(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  /** Slugs dos relatórios liberados na página pública; nulo = mostra todos. */
  publicSections: jsonb("public_sections").$type<string[]>(),
  /** Lançamentos (contábeis ou financeiros) com data até aqui ficam bloqueados; nulo = sem bloqueio. */
  periodLockedUntil: date("period_locked_until"),
  ...timestamps,
}).enableRLS();

/** Quais empresas cada usuário "user" pode acessar; administradores sempre acessam todas. */
export const userCompanies = pgTable(
  "user_companies",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.companyId] }), index("user_companies_company").on(t.companyId)],
).enableRLS();

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

/** Módulo financeiro: entradas e saídas do fluxo de caixa. */
export const cashFlowEntries = pgTable(
  "cash_flow_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    type: cashFlowType("type").notNull(),
    description: text("description").notNull(),
    category: text("category"),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    frequency: cashFlowFrequency("frequency").notNull().default("unica"),
    /** Ocorrências geradas por um mesmo lançamento recorrente compartilham a série. */
    seriesId: uuid("series_id"),
    /** Aplicação financeira movimentada: aporte (economia) ou resgate (entrada). */
    investmentId: uuid("investment_id").references((): AnyPgColumn => investments.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("cash_flow_entries_company_date").on(t.companyId, t.date),
    index("cash_flow_entries_series").on(t.seriesId),
  ],
).enableRLS();

/** Comprovantes anexados a um lançamento contábil ou a uma movimentação do fluxo de caixa. */
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, { onDelete: "cascade" }),
    cashFlowEntryId: uuid("cash_flow_entry_id").references(() => cashFlowEntries.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    /** Caminho no bucket "anexos" (privado; acesso sempre via signed URL). */
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** Se true, o anexo aparece também na página pública da empresa (quando publicada). */
    isPublic: boolean("is_public").notNull().default(false),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("attachments_journal_entry").on(t.journalEntryId),
    index("attachments_cash_flow_entry").on(t.cashFlowEntryId),
  ],
).enableRLS();

/** Extrato bancário importado em OFX. */
export const bankStatements = pgTable(
  "bank_statements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** Conta contábil que representa essa conta bancária no plano de contas. */
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    fileName: text("file_name").notNull(),
    /** Arquivo original no bucket "anexos". */
    storagePath: text("storage_path").notNull(),
    importedBy: uuid("imported_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("bank_statements_company").on(t.companyId)],
).enableRLS();

/** Cada transação (STMTTRN) de um extrato importado, pendente ou já conciliada. */
export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    statementId: uuid("statement_id")
      .notNull()
      .references(() => bankStatements.id, { onDelete: "cascade" }),
    /** Id da transação no OFX (FITID); evita reimportar duplicado. */
    fitId: text("fit_id"),
    date: date("date").notNull(),
    /** Centavos, com sinal: positivo = entrada/crédito, negativo = saída/débito. */
    amountCents: integer("amount_cents").notNull(),
    description: text("description").notNull(),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, { onDelete: "set null" }),
    cashFlowEntryId: uuid("cash_flow_entry_id").references(() => cashFlowEntries.id, { onDelete: "set null" }),
    /** Conciliada automaticamente por um Knot, sem intervenção manual. */
    matchedByKnot: boolean("matched_by_knot").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("bank_transactions_statement").on(t.statementId),
    uniqueIndex("bank_transactions_statement_fit").on(t.statementId, t.fitId),
  ],
).enableRLS();

/** Regra de conciliação automática ("Knot"): mesma descrição do extrato reaplica a última escolha. */
export const reconciliationRules = pgTable(
  "reconciliation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** Descrição normalizada (maiúsculas, espaços colapsados) usada como chave de match. */
    pattern: text("pattern").notNull(),
    module: reconciliationModule("module").notNull(),
    counterAccountId: uuid("counter_account_id").references(() => accounts.id, { onDelete: "set null" }),
    historyCode: integer("history_code"),
    cashCategory: text("cash_category"),
    ...timestamps,
  },
  (t) => [uniqueIndex("reconciliation_rules_company_pattern").on(t.companyId, t.pattern)],
).enableRLS();

/** Aplicações financeiras (CDB, Tesouro, poupança...). Aportes e resgates entram no fluxo de caixa. */
export const investments = pgTable(
  "investments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: investmentKind("kind").notNull().default("outro"),
    institution: text("institution"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("investments_company").on(t.companyId)],
).enableRLS();

/** Saldo informado de uma aplicação numa data (inclui rendimentos); base para o saldo atual. */
export const investmentValuations = pgTable(
  "investment_valuations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investmentId: uuid("investment_id")
      .notNull()
      .references(() => investments.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    balance: numeric("balance", { precision: 18, scale: 2 }).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("investment_valuations_investment_date").on(t.investmentId, t.date)],
).enableRLS();

/** Plano financeiro anual: um por empresa e ano; o texto de cada seção fica em `content` (JSON do editor). */
export const financialPlans = pgTable(
  "financial_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    title: text("title").notNull(),
    /** Período analisado no diagnóstico. */
    diagnosisFrom: date("diagnosis_from").notNull(),
    diagnosisTo: date("diagnosis_to").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("financial_plans_company_year").on(t.companyId, t.year)],
).enableRLS();

/** Orçamento do plano: valor por tipo de movimentação, categoria do fluxo de caixa e mês. */
export const planBudgetItems = pgTable(
  "plan_budget_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => financialPlans.id, { onDelete: "cascade" }),
    type: cashFlowType("type").notNull(),
    category: text("category").notNull(),
    month: integer("month").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  },
  (t) => [uniqueIndex("plan_budget_items_unique").on(t.planId, t.type, t.category, t.month)],
).enableRLS();

/** Metas do planejamento (reserva de emergência, compra, aposentadoria...). */
export const planGoals = pgTable(
  "plan_goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => financialPlans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetAmount: numeric("target_amount", { precision: 18, scale: 2 }).notNull(),
    /** Valor já acumulado quando a meta não está ligada a uma aplicação. */
    initialAmount: numeric("initial_amount", { precision: 18, scale: 2 }).notNull().default("0"),
    deadline: date("deadline").notNull(),
    /** 1 = alta, 2 = média, 3 = baixa. */
    priority: integer("priority").notNull().default(2),
    /** Rentabilidade esperada, em % ao ano. */
    annualReturn: numeric("annual_return", { precision: 7, scale: 3 }).notNull().default("0"),
    investmentId: uuid("investment_id").references(() => investments.id, { onDelete: "set null" }),
    notes: text("notes"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("plan_goals_plan").on(t.planId)],
).enableRLS();

/** Cenário econômico para projeção do fluxo de caixa (taxas em % ao ano). */
export const planScenarios = pgTable(
  "plan_scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => financialPlans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#3b82f6"),
    position: integer("position").notNull().default(0),
    revenueGrowth: numeric("revenue_growth", { precision: 7, scale: 3 }).notNull().default("0"),
    expenseGrowth: numeric("expense_growth", { precision: 7, scale: 3 }).notNull().default("0"),
    inflation: numeric("inflation", { precision: 7, scale: 3 }).notNull().default("0"),
    investmentReturn: numeric("investment_return", { precision: 7, scale: 3 }).notNull().default("0"),
    horizonMonths: integer("horizon_months").notNull().default(12),
    /** Eventos pontuais: { month: "AAAA-MM", description, cents } (cents > 0 entra, < 0 sai). */
    events: jsonb("events").$type<{ month: string; description: string; cents: number }[]>().notNull().default([]),
  },
  (t) => [index("plan_scenarios_plan").on(t.planId)],
).enableRLS();

/** Versões salvas do plano: cópia do texto, dados e números da época. */
export const planVersions = pgTable(
  "plan_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => financialPlans.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    label: text("label").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("plan_versions_plan_number").on(t.planId, t.number)],
).enableRLS();

/** Imagens e arquivos inseridos nos textos do plano (bucket "anexos"). */
export const planFiles = pgTable(
  "plan_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => financialPlans.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("plan_files_plan").on(t.planId)],
).enableRLS();

export const accountsRelations = relations(accounts, ({ one }) => ({
  dreCategory: one(dreCategories, {
    fields: [accounts.dreCategoryId],
    references: [dreCategories.id],
  }),
}));

export const journalEntriesRelations = relations(journalEntries, ({ many }) => ({
  lines: many(journalLines),
  attachments: many(attachments),
}));

export const cashFlowEntriesRelations = relations(cashFlowEntries, ({ many }) => ({
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [attachments.journalEntryId],
    references: [journalEntries.id],
  }),
  cashFlowEntry: one(cashFlowEntries, {
    fields: [attachments.cashFlowEntryId],
    references: [cashFlowEntries.id],
  }),
}));

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  entry: one(journalEntries, { fields: [journalLines.entryId], references: [journalEntries.id] }),
  account: one(accounts, { fields: [journalLines.accountId], references: [accounts.id] }),
}));

export const bankStatementsRelations = relations(bankStatements, ({ many }) => ({
  transactions: many(bankTransactions),
}));

export const bankTransactionsRelations = relations(bankTransactions, ({ one }) => ({
  statement: one(bankStatements, { fields: [bankTransactions.statementId], references: [bankStatements.id] }),
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
