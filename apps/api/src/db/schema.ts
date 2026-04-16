import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  datetime,
  mysqlEnum,
} from 'drizzle-orm/mysql-core'

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  instagramId: varchar('instagram_id', { length: 64 }),
  instagramAccessToken: text('instagram_access_token'),
  instagramTokenExpiresAt: datetime('instagram_token_expires_at'),
  instagramUsername: varchar('instagram_username', { length: 64 }),
  maxPublicLinks: int('max_public_links').default(3).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const templates = mysqlTable('templates', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  config: text('config').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
})

export const scheduledEmails = mysqlTable('scheduled_emails', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  templateName: varchar('template_name', { length: 255 }),
  emailTo: varchar('email_to', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }),
  sendAt: datetime('send_at').notNull(),
  renderConfig: text('render_config').notNull(),
  status: mysqlEnum('status', ['pending', 'sent', 'failed']).default('pending').notNull(),
  retryCount: int('retry_count').default(0).notNull(),
  nextRetryAt: datetime('next_retry_at'),
  errorMsg: text('error_msg'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const scheduledPosts = mysqlTable('scheduled_posts', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  templateName: varchar('template_name', { length: 255 }),
  scheduledAt: datetime('scheduled_at').notNull(),
  renderConfig: text('render_config').notNull(),
  status: mysqlEnum('status', ['pending', 'published', 'failed']).default('pending').notNull(),
  retryCount: int('retry_count').default(0).notNull(),
  nextRetryAt: datetime('next_retry_at'),
  igMediaId: varchar('ig_media_id', { length: 128 }),
  igPostUrl: varchar('ig_post_url', { length: 512 }),
  errorMsg: text('error_msg'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const publicLinks = mysqlTable('public_links', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull().default('Mi Menú'),
  slug: varchar('slug', { length: 32 }).notNull().unique(),
  customDomain: varchar('custom_domain', { length: 255 }),
  pageCount: int('page_count').default(0).notNull(),
  lastPublishedAt: datetime('last_published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
