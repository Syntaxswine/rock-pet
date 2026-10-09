import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

// One hot row. A revision and an unpredictable write token guard every transaction.
export const rock = sqliteTable('rock', {
  id: integer('id').primaryKey(), revision: integer('revision').notNull(),
  state: text('state').notNull(), observedAt: integer('observed_at').notNull(),
  token: text('token').notNull(),
});
export const events = sqliteTable('rock_events', {
  seq: integer('seq').primaryKey({ autoIncrement: true }),
  token: text('token').notNull().unique(), at: integer('at').notNull(),
  kind: text('kind').notNull(), payload: text('payload').notNull(),
});
export const names = sqliteTable('rock_names', {
  name: text('name').primaryKey(), born: integer('born').notNull(),
});
export const limits = sqliteTable('rock_limits', {
  id: integer('id').primaryKey(), window: integer('window').notNull(), count: integer('count').notNull(),
});
