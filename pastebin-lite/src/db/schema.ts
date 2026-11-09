import { pgTable, serial, text, timestamp, integer, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const pastes = pgTable('pastes', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
  maxViews: integer('max_views'),
  viewCount: integer('view_count').notNull().default(0),
  creatorUid: text('creator_uid'),
}, (table) => [
  index('slug_idx').on(table.slug),
  index('expires_at_idx').on(table.expiresAt),
]);
