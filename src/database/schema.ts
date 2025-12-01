import { sql } from 'drizzle-orm'
import {
    boolean,
    check,
    foreignKey,
    index,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    text,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
} from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
    username: text('username').unique(),
    displayUsername: text('display_username'),
    isAnonymous: boolean('is_anonymous'),
    settings: jsonb().default({}),
})

export const session = pgTable('session', {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
})

export const verification = pgTable('verification', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
})

export const blockType = pgEnum('block_type', [
    'root',
    'text',
    'todo',
    'heading',
    'list',
    'cycle',
    'final',
    'container',
    'image',
    'media',
    'link',
    'unit_ref',
    'calendar',
    'goal',
    'context',
    'excalidraw',
    'startPoint',
    'endPoint',
    'company',
    'department',
    'position',
    'page',
    'database',
    'column',
    'column_list',
    'rule',
    'event',
    'role',
    'group',
    'table'
])

export const block = pgTable(
    'block',
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: text('user_id').notNull(),
        parentId: uuid('parent_id'),
        groupId: uuid('group_id'), // Логическая группировка (планета, проект и т.д.)
        type: blockType().notNull(),
        title: text(),
        content: jsonb().default({}),
        archived: boolean().default(false),
        tags: jsonb().default([]),
        position: integer(),
        hasChildren: boolean('has_children').default(false).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
        layoutData: jsonb('layout_data').default({}),
    },
    (table) => [
        index('block_archived_partial_idx')
            .using('btree', table.id.asc().nullsLast().op('uuid_ops'))
            .where(sql`(archived = false)`),
        index('block_content_gin_idx').using(
            'gin',
            table.content.asc().nullsLast().op('jsonb_ops'),
        ),
        index('block_layout_data_gin_idx').using(
            'gin',
            table.layoutData.asc().nullsLast().op('jsonb_ops'),
        ),
        index('block_parent_idx').using(
            'btree',
            table.parentId.asc().nullsLast().op('uuid_ops'),
        ),
        index('block_parent_position_idx').using(
            'btree',
            table.parentId.asc().nullsLast().op('uuid_ops'),
            table.position.asc().nullsLast().op('int4_ops'),
        ),
        index('block_group_idx').using(
            'btree',
            table.groupId.asc().nullsLast().op('uuid_ops'),
        ),
        index('block_tags_gin_idx').using(
            'gin',
            table.tags.asc().nullsLast().op('jsonb_ops'),
        ),
        index('block_type_idx').using(
            'btree',
            table.type.asc().nullsLast().op('enum_ops'),
        ),
        index('block_user_idx').using(
            'btree',
            table.userId.asc().nullsLast().op('text_ops'),
        ),
        foreignKey({
            columns: [table.parentId],
            foreignColumns: [table.id],
            name: 'block_parent_id_block_id_fk',
        }).onDelete('set null'),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [user.id],
            name: 'block_user_id_user_id_fk',
        }).onDelete('cascade'),
    ],
)

export const currency = pgTable(
    'currency',
    {
        id: text().primaryKey().notNull(),
        userId: text('user_id').notNull(),
        coins: integer().default(0).notNull(),
        physicalEnergy: integer('physical_energy').default(100).notNull(),
        mentalEnergy: integer('mental_energy').default(100).notNull(),
        willpower: integer().default(100).notNull(),
        scrolls: integer().default(0).notNull(),
        lastDailyReward: timestamp('last_daily_reward', {
            precision: 6,
            withTimezone: true,
            mode: 'string',
        }),
        updatedAt: timestamp('updated_at', {
            precision: 6,
            withTimezone: true,
            mode: 'string',
        })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
    },
    (table) => [
        uniqueIndex('unique_user_currency').using(
            'btree',
            table.userId.asc().nullsLast().op('text_ops'),
        ),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [user.id],
            name: 'currency_user_id_user_id_fk',
        }),
    ],
)

export const energyChangeLog = pgTable(
    'energy_change_log',
    {
        id: text().primaryKey().notNull(),
        userId: text('user_id').notNull(),
        energyType: text('energy_type').notNull(), // 'physical', 'mental', 'willpower'
        oldValue: integer('old_value').notNull(),
        newValue: integer('new_value').notNull(),
        reason: text(), // причина изменения (опционально)
        createdAt: timestamp('created_at', {
            precision: 6,
            withTimezone: true,
            mode: 'string',
        })
            .default(sql`CURRENT_TIMESTAMP`)
            .notNull(),
    },
    (table) => [
        index('idx_energy_log_user').using(
            'btree',
            table.userId.asc().nullsLast().op('text_ops'),
        ),
        index('idx_energy_log_created').using(
            'btree',
            table.createdAt.desc().nullsLast(),
        ),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [user.id],
            name: 'energy_change_log_user_id_fk',
        }).onDelete('cascade'),
    ],
)

export const unit = pgTable(
    'unit',
    {
        id: text().primaryKey().notNull(),
        userId: text('user_id').notNull(),
        name: text().notNull(),
        description: text(),
        model: text().notNull(),
        systemPrompt: text('system_prompt').notNull(),
        tools: jsonb().default([]),
        isDefault: boolean('is_default').default(false),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        avatarUrl: text('avatar_url'),
        unitType: text('unit_type').default('assistant').notNull(),
        agentConnectionType: text('agent_connection_type').default('model').notNull(),
        webhookUrl: text('webhook_url'),
        webhookSecret: text('webhook_secret'),
        favoriteOrder: numeric('favorite_order'),
    },
    (table) => [
        index('assistants_name_idx').using(
            'btree',
            table.name.asc().nullsLast().op('text_ops'),
        ),
        index('assistants_user_id_idx').using(
            'btree',
            table.userId.asc().nullsLast().op('text_ops'),
        ),
        index('unit_type_idx').using(
            'btree',
            table.unitType.asc().nullsLast().op('text_ops'),
        ),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [user.id],
            name: 'assistants_user_id_user_id_fk',
        }).onDelete('cascade'),
        check(
            'mode_valid',
            sql`agent_connection_type = ANY (ARRAY['model'::text, 'webhook'::text])`,
        ),
        check(
            'unit_type_valid',
            sql`unit_type = ANY (ARRAY['assistant'::text, 'human'::text, 'timelix'::text, 'system'::text])`,
        ),
    ],
)

export const unitLink = pgTable(
    'unit_link',
    {
        id: text().primaryKey().notNull(),
        unitId: text('unit_id').notNull(),
        blockId: uuid('block_id'),
        role: text(),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index('unit_link_block_id_idx').using(
            'btree',
            table.blockId.asc().nullsLast().op('uuid_ops'),
        ),
        index('unit_link_unit_id_idx').using(
            'btree',
            table.unitId.asc().nullsLast().op('text_ops'),
        ),
        foreignKey({
            columns: [table.blockId],
            foreignColumns: [block.id],
            name: 'unit_link_block_id_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.unitId],
            foreignColumns: [unit.id],
            name: 'unit_link_unit_id_fk',
        }).onDelete('cascade'),
    ],
)

export const councilSeats = pgTable(
    'council_seats',
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        seatNumber: integer('seat_number').notNull(),
        roleId: uuid('role_id')
            .notNull()
            .references(() => block.id, { onDelete: 'cascade' }),
        hasVotingRight: boolean('has_voting_right').default(true).notNull(),
        votingWeight: integer('voting_weight').default(1).notNull(),
        assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        unique('council_seats_user_seat_unique').on(table.userId, table.seatNumber),
        unique('council_seats_user_role_unique').on(table.userId, table.roleId),
        index('council_seats_user_idx').using(
            'btree',
            table.userId.asc().nullsLast().op('text_ops'),
        ),
        index('council_seats_role_idx').using(
            'btree',
            table.roleId.asc().nullsLast().op('uuid_ops'),
        ),
        check('seat_number_valid', sql`"seat_number" >= 1 AND "seat_number" <= 30`),
    ],
)

// Настройки Совета агентов
export const councilSettingsTable = pgTable(
    'council_settings',
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        responseLength: text('response_length').default('medium').notNull(),
        maxWords: integer('max_words'),
        conflictLevel: text('conflict_level').default('neutral').notNull(),
        customInstructions: text('custom_instructions'),
        layerPriorities: jsonb('layer_priorities').default({
            council: 1,
            context: 2,
            agent: 3,
            history: 4,
            custom: 5,
        }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        unique('council_settings_user_unique').on(table.userId),
        index('council_settings_user_idx').using(
            'btree',
            table.userId.asc().nullsLast().op('text_ops'),
        ),
    ],
)

export const groups = pgTable(
    'groups',
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        title: text().notNull(),
        description: text(),
        color: text().default('#4A90E2').notNull(),
        icon: text().default('🌍'),
        metadata: jsonb().default({}),
        layoutData: jsonb('layout_data').default({}),
        position: integer().default(1024).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index('groups_user_idx').using(
            'btree',
            table.userId.asc().nullsLast().op('text_ops'),
        ),
        index('groups_position_idx').using(
            'btree',
            table.userId.asc().nullsLast().op('text_ops'),
            table.position.asc().nullsLast().op('int4_ops'),
        ),
        index('groups_layout_data_gin_idx').using(
            'gin',
            table.layoutData.asc().nullsLast().op('jsonb_ops'),
        ),
    ],
)

export const workplace = pgTable(
    'workplace',
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        title: text().default('Мой воркспейс').notNull(),
        description: text(),
        layoutData: jsonb('layout_data').default({}),
        content: jsonb().default({}),
        isDefault: boolean('is_default').default(false).notNull(),
        archived: boolean().default(false).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index('workplace_user_idx').using(
            'btree',
            table.userId.asc().nullsLast().op('text_ops'),
        ),
        index('workplace_user_default_idx')
            .using('btree', table.userId.asc().nullsLast().op('text_ops'))
            .where(sql`(is_default = true)`),
    ],
)

export const moduleTypeEnum = pgEnum('module_type', [
    'N8nConnector',
    'ToDoList',
    'Custom',
    'Agent', // Полноценный агент со всеми настройками
])

export const licenseTypeEnum = pgEnum('license_type', [
    'open',
    'closed',
])

export const storeModules = pgTable(
    'store_modules',
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        authorId: text('author_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        name: text().notNull(),
        description: text(),
        moduleType: moduleTypeEnum('module_type').notNull(),
        config: jsonb().default({}).notNull(),
        licenseType: licenseTypeEnum('license_type').default('open').notNull(),
        price: numeric(),
        downloads: integer().default(0).notNull(),
        isPublished: boolean('is_published').default(false).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index('store_modules_author_idx').using(
            'btree',
            table.authorId.asc().nullsLast().op('text_ops'),
        ),
        index('store_modules_type_idx').using(
            'btree',
            table.moduleType.asc().nullsLast().op('enum_ops'),
        ),
        index('store_modules_published_idx')
            .using('btree', table.id.asc().nullsLast().op('uuid_ops'))
            .where(sql`(is_published = true)`),
    ],
)

export const mcpAccessTokens = pgTable(
    'mcp_access_tokens',
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        token: text().notNull().unique(),
        userId: text('user_id')
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        agentId: uuid('agent_id')
            .notNull()
            .references(() => block.id, { onDelete: 'cascade' }),
        todoListId: text('todo_list_id').notNull(),
        isActive: boolean('is_active').default(true).notNull(),
        expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
        usageCount: integer('usage_count').default(0).notNull(),
        lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'string' }),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index('mcp_tokens_user_idx').using(
            'btree',
            table.userId.asc().nullsLast().op('text_ops'),
        ),
        index('mcp_tokens_agent_idx').using(
            'btree',
            table.agentId.asc().nullsLast().op('uuid_ops'),
        ),
        index('mcp_tokens_token_idx').using(
            'btree',
            table.token.asc().nullsLast().op('text_ops'),
        ),
        index('mcp_tokens_active_idx')
            .using('btree', table.token.asc().nullsLast().op('text_ops'))
            .where(sql`(is_active = true)`),
    ],
)
