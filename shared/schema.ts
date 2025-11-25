import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users (system users with login credentials)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(), // hashed password
  name: text("name").notNull(),
  role: text("role").notNull().default("user"), // "admin" or "user"
  createdAt: timestamp("created_at").defaultNow(),
});

// Account holders (people who own betting accounts)
export const accountHolders = pgTable("account_holders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email"),
  username: text("username"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Betting houses (casas de apostas)
export const bettingHouses = pgTable("betting_houses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  notes: text("notes"), // Campo para notas/informações adicionais
  accountHolderId: varchar("account_holder_id").references(() => accountHolders.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Surebet sets (each OCR extraction creates one set with two bets)
export const surebetSets = pgTable("surebet_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  eventDate: timestamp("event_date"),
  sport: text("sport"),
  league: text("league"),
  teamA: text("team_a"),
  teamB: text("team_b"),
  profitPercentage: decimal("profit_percentage", { precision: 5, scale: 2 }),
  status: text("status").default("pending"), // pending, resolved
  isChecked: boolean("is_checked").default(false), // user verification flag
  createdAt: timestamp("created_at").defaultNow(),
});

// Individual bets within a surebet set
export const bets = pgTable("bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  surebetSetId: varchar("surebet_set_id").references(() => surebetSets.id),
  bettingHouseId: varchar("betting_house_id").references(() => bettingHouses.id),
  betType: text("bet_type").notNull(), // "Acima 2.25", "1x2", etc.
  odd: decimal("odd", { precision: 8, scale: 3 }).notNull(),
  stake: decimal("stake", { precision: 10, scale: 2 }).notNull(),
  potentialProfit: decimal("potential_profit", { precision: 10, scale: 2 }).notNull(),
  result: text("result"), // "won", "lost", "returned", "half_won", "half_returned", null for pending
  actualProfit: decimal("actual_profit", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertAccountHolderSchema = createInsertSchema(accountHolders).omit({
  id: true,
  createdAt: true,
});

export const insertBettingHouseSchema = createInsertSchema(bettingHouses).omit({
  id: true,
  createdAt: true,
});

export const insertSurebetSetSchema = createInsertSchema(surebetSets).omit({
  id: true,
  createdAt: true,
}).extend({
  eventDate: z.union([z.date(), z.string().nullable()]).transform((val) => {
    if (typeof val === 'string') {
      return new Date(val);
    }
    return val;
  }).nullable(),
});

export const insertBetSchema = createInsertSchema(bets).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type AccountHolder = typeof accountHolders.$inferSelect;
export type InsertAccountHolder = z.infer<typeof insertAccountHolderSchema>;

export type BettingHouse = typeof bettingHouses.$inferSelect;
export type InsertBettingHouse = z.infer<typeof insertBettingHouseSchema>;

export type SurebetSet = typeof surebetSets.$inferSelect;
export type InsertSurebetSet = z.infer<typeof insertSurebetSetSchema>;

export type Bet = typeof bets.$inferSelect;
export type InsertBet = z.infer<typeof insertBetSchema>;

// Combined types for API responses
export type BettingHouseWithAccountHolder = BettingHouse & {
  accountHolder: AccountHolder | null;
};

export type SurebetSetWithBets = SurebetSet & {
  bets: (Bet & {
    bettingHouse: BettingHouse & {
      accountHolder: AccountHolder;
    };
  })[];
};

// OCR extraction result type - allows null values for missing data (no fallbacks)
// Supports 2 or 3 bets per surebet
export type OCRResult = {
  date: string | null;
  sport: string | null;
  league: string | null;
  teamA: string | null;
  teamB: string | null;
  bet1: {
    house: string | null;
    odd: number | null;
    type: string | null;
    stake: number | null;
    profit: number | null;
    accountHolder?: string;
  };
  bet2: {
    house: string | null;
    odd: number | null;
    type: string | null;
    stake: number | null;
    profit: number | null;
    accountHolder?: string;
  };
  bet3?: {
    house: string | null;
    odd: number | null;
    type: string | null;
    stake: number | null;
    profit: number | null;
    accountHolder?: string;
  };
  profitPercentage: number | null;
};