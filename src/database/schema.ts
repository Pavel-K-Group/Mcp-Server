import {
    pgTable,
    foreignKey,
    text,
    timestamp,
    uniqueIndex,
    integer,
    unique,
    index,
    boolean,
    jsonb,
    uuid,
    check,
    pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// PostgreSQL enum для типов блоков
export const blockTypeEnum = pgEnum('block_type', [
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
])

// TypeScript типы для типобезопасности
export type BlockType =
    | 'root'
    | 'event'
    | 'text'
    | 'todo'
    | 'heading'
    | 'list'
    | 'cycle'
    | 'final'
    | 'container'
    | 'image'
    | 'media'
    | 'link'
    | 'unit_ref'
    | 'calendar'
    | 'goal'
    | 'context'
    | 'excalidraw'
    | 'startPoint'
    | 'endPoint'
    | 'company'
    | 'department'
    | 'position'
    | 'page'
    | 'database'
    | 'column'
    | 'column_list'
    | 'rule'
export type UnitType = 'assistant' | 'human' | 'timelix' | 'system'

export const account = pgTable(
    'account',
    {
        id: text().primaryKey().notNull(),
        accountId: text('account_id').notNull(),
        providerId: text('provider_id').notNull(),
        userId: text('user_id').notNull(),
        accessToken: text('access_token'),
        refreshToken: text('refresh_token'),
        idToken: text('id_token'),
        accessTokenExpiresAt: timestamp('access_token_expires_at', { mode: 'date' }),
        refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { mode: 'date' }),
        scope: text(),
        password: text(),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
    },
    (table) => [
        foreignKey({
            columns: [table.userId],
            foreignColumns: [user.id],
            name: 'account_user_id_user_id_fk',
        }).onDelete('cascade'),
    ],
)

export const currency = pgTable(
    'currency',
    {
        id: text().primaryKey().notNull(),
        userId: text('user_id').notNull(),
        coins: integer().default(0).notNull(),
        energy: integer().default(0).notNull(),
        scrolls: integer().default(0).notNull(),
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

export const session = pgTable(
    'session',
    {
        id: text().primaryKey().notNull(),
        expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
        token: text().notNull(),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
        userId: text('user_id').notNull(),
    },
    (table) => [
        foreignKey({
            columns: [table.userId],
            foreignColumns: [user.id],
            name: 'session_user_id_user_id_fk',
        }).onDelete('cascade'),
        unique('session_token_unique').on(table.token),
    ],
)

export const unit = pgTable(
    'unit',
    {
        id: text().primaryKey().notNull(),
        userId: text('user_id').notNull(),
        name: text().notNull(),
        description: text(),
        avatar: text(),
        avatarType: text('avatar_type').default('emoji').notNull(), // 'emoji' | 'generated' | 'uploaded'
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
        // Проверка типов unit
        check(
            'unit_type_valid',
            sql`${table.unitType} IN ('assistant','human','timelix','system')`,
        ),
        // Проверка типов аватара
        check(
            'avatar_type_valid',
            sql`${table.avatarType} IN ('emoji','generated','uploaded')`,
        ),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [user.id],
            name: 'assistants_user_id_user_id_fk',
        }).onDelete('cascade'),
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

export const user = pgTable(
    'user',
    {
        id: text().primaryKey().notNull(),
        name: text().notNull(),
        email: text().notNull(),
        emailVerified: boolean('email_verified').notNull(),
        image: text(),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
        username: text(),
        isAnonymous: boolean('is_anonymous'),
    },
    (table) => [
        unique('user_email_unique').on(table.email),
        unique('user_username_unique').on(table.username),
    ],
)

export const verification = pgTable('verification', {
    id: text().primaryKey().notNull(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }),
    updatedAt: timestamp('updated_at', { mode: 'date' }),
})

export const block = pgTable(
    'block',
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: text('user_id').notNull(),
        parentId: uuid('parent_id'),
        type: blockTypeEnum('type').notNull(),
        title: text(),
        content: jsonb().default({}),
        layoutData: jsonb('layout_data').default({}),
        archived: boolean().default(false),
        tags: jsonb().default([]),
        position: integer().default(1024).notNull(),
        hasChildren: boolean('has_children').default(false).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    },
    (table) => [
        index('block_parent_idx').using(
            'btree',
            table.parentId.asc().nullsLast().op('uuid_ops'),
        ),
        index('block_type_idx').using('btree', table.type.asc().nullsLast()),
        index('block_user_idx').using(
            'btree',
            table.userId.asc().nullsLast().op('text_ops'),
        ),
        index('block_parent_position_idx').using(
            'btree',
            table.parentId.asc().nullsLast().op('uuid_ops'),
            table.position.asc().nullsLast().op('int4_ops'),
        ),
        index('block_content_gin_idx').using('gin', table.content),
        index('block_layout_data_gin_idx').using('gin', table.layoutData),
        index('block_tags_gin_idx').using('gin', table.tags),
        index('block_archived_partial_idx')
            .using('btree', table.id.asc().nullsLast().op('uuid_ops'))
            .where(sql`archived = false`),
        // Критичные проверки безопасности
        check('block_position_positive', sql`${table.position} > 0`),
        // Уникальность позиций в пределах родителя
        unique('block_parent_position_unique').on(table.parentId, table.position),
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

// Минимальные database таблицы для будущего расширения
export const database = pgTable(
    'database',
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        blockId: uuid('block_id').notNull(),
        title: text().notNull(),
        description: text(),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index('database_block_id_idx').using(
            'btree',
            table.blockId.asc().nullsLast().op('uuid_ops'),
        ),
        unique('database_block_id_unique').on(table.blockId),
        foreignKey({
            columns: [table.blockId],
            foreignColumns: [block.id],
            name: 'database_block_id_block_id_fk',
        }).onDelete('cascade'),
    ],
)

export const databaseProperty = pgTable(
    'database_property',
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        databaseId: uuid('database_id').notNull(),
        name: text().notNull(),
        propType: text('prop_type').notNull(),
        config: jsonb().default({}),
        position: integer().default(1024).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index('database_property_database_id_idx').using(
            'btree',
            table.databaseId.asc().nullsLast().op('uuid_ops'),
        ),
        index('database_property_position_idx').using(
            'btree',
            table.databaseId.asc().nullsLast().op('uuid_ops'),
            table.position.asc().nullsLast().op('int4_ops'),
        ),
        // Безопасность и уникальность
        unique('database_property_database_name_unique').on(table.databaseId, table.name),
        unique('database_property_database_position_unique').on(
            table.databaseId,
            table.position,
        ),
        check('database_property_position_positive', sql`${table.position} > 0`),
        check(
            'database_property_type_valid',
            sql`${table.propType} IN ('title','text','number','select','multi_select','date','checkbox','url','email','phone','formula')`,
        ),
        foreignKey({
            columns: [table.databaseId],
            foreignColumns: [database.id],
            name: 'database_property_database_id_database_id_fk',
        }).onDelete('cascade'),
    ],
)

// View system - отделяем контент от представления
export const view = pgTable(
    'view',
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        parentDatabaseId: uuid('parent_database_id'),
        viewType: text('view_type').notNull(), // 'table' | 'board' | 'calendar' | 'gallery' | 'list' | 'timeline' | 'map' | 'flow' | 'grid'
        name: text().notNull(),
        config: jsonb().default({}), // фильтры, сортировка, группировка, настройки представления
        position: integer().default(1024).notNull(),
        isDefault: boolean('is_default').default(false).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index('view_parent_database_idx').using(
            'btree',
            table.parentDatabaseId.asc().nullsLast().op('uuid_ops'),
        ),
        index('view_type_idx').using(
            'btree',
            table.viewType.asc().nullsLast().op('text_ops'),
        ),
        index('view_config_gin_idx').using('gin', table.config),
        // Уникальность позиций в пределах parent database
        unique('view_parent_position_unique').on(table.parentDatabaseId, table.position),
        // Проверки валидности
        check('view_position_positive', sql`${table.position} > 0`),
        check(
            'view_type_valid',
            sql`${table.viewType} IN ('table','board','calendar','gallery','list','timeline','map','flow','grid')`,
        ),
        foreignKey({
            columns: [table.parentDatabaseId],
            foreignColumns: [database.id],
            name: 'view_parent_database_id_database_id_fk',
        }).onDelete('cascade'),
    ],
)

export const viewBlock = pgTable(
    'view_block',
    {
        viewId: uuid('view_id').notNull(),
        blockId: uuid('block_id').notNull(),
        layout: jsonb().default({}), // координаты, размеры, цвет, видимость и другие view-специфичные данные
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        // Составной первичный ключ
        { primaryKey: true, columns: [table.viewId, table.blockId] },
        index('view_block_view_id_idx').using(
            'btree',
            table.viewId.asc().nullsLast().op('uuid_ops'),
        ),
        index('view_block_block_id_idx').using(
            'btree',
            table.blockId.asc().nullsLast().op('uuid_ops'),
        ),
        index('view_block_layout_gin_idx').using('gin', table.layout),
        foreignKey({
            columns: [table.viewId],
            foreignColumns: [view.id],
            name: 'view_block_view_id_view_id_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.blockId],
            foreignColumns: [block.id],
            name: 'view_block_block_id_block_id_fk',
        }).onDelete('cascade'),
    ],
)

export const unitBlockRoles = pgTable(
    'unit_block_roles',
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        unitId: text('unit_id').notNull(),
        blockId: uuid('block_id').notNull(),
        roleTitle: text('role_title'),
        managerUnitId: text('manager_unit_id'),
        isActive: boolean('is_active').default(true).notNull(),
        isChatEnabled: boolean('is_chat_enabled').default(false).notNull(),
        hiredAt: timestamp('hired_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
        firedAt: timestamp('fired_at', { withTimezone: true, mode: 'string' }),
        createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index('unit_block_roles_unit_id_idx').using(
            'btree',
            table.unitId.asc().nullsLast().op('text_ops'),
        ),
        index('unit_block_roles_block_id_idx').using(
            'btree',
            table.blockId.asc().nullsLast().op('uuid_ops'),
        ),
        index('unit_block_roles_active_idx').using(
            'btree',
            table.isActive.asc().nullsLast().op('bool_ops'),
        ),
        foreignKey({
            columns: [table.unitId],
            foreignColumns: [unit.id],
            name: 'unit_block_roles_unit_id_unit_id_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.blockId],
            foreignColumns: [block.id],
            name: 'unit_block_roles_block_id_block_id_fk',
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.managerUnitId],
            foreignColumns: [unit.id],
            name: 'unit_block_roles_manager_unit_id_unit_id_fk',
        }).onDelete('set null'),
    ],
)
