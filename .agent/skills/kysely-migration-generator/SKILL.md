---
name: kysely-migration-generator
description: Translates a Mermaid ERD (docs/architecture/schema.mmd or erd.svg) into a type-safe Kysely database migration in src/db/migrations/. Use when asked to generate, write, or create a Kysely migration, database migration, or SQL tables from an ERD, Mermaid diagram, schema.mmd, or data model.
---

# Kysely Migration Generator

Read a Mermaid `erDiagram` from `docs/architecture/` and turn it into a Kysely migration in `src/db/migrations/`. Use `src/db/migrations/001_initial_schema.ts` as the reference for structure and style.

## Translation Rules

### Entities → Tables

- Map each Mermaid entity to a snake_case table name: `USERS` → `users`, `BOOK_AUTHORS` → `book_authors`.
- Map each attribute name to a snake_case column name.
- Skip any table that an earlier migration in `src/db/migrations/` already creates (e.g. `users` in `001_initial_schema.ts`). Do not create it in `up` or drop it in `down`. New tables can still reference it.

### Keys & Columns

- **`PK`** becomes an auto-generating ID:
  - `int id PK` → `.addColumn('id', 'serial', (col) => col.primaryKey())`
  - `uuid id PK` → `.addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql\`gen_random_uuid()\`))`
- **`FK`** becomes a `.references().onDelete('cascade')` column whose type matches the parent's PK (`integer` for a `serial` parent, `uuid` for a `uuid` parent):
  - `int user_id FK` → `.addColumn('user_id', 'integer', (col) => col.references('users.id').onDelete('cascade').notNull())`
- **`UK`** → `.unique()`
- Attribute types:

  | Mermaid | Kysely |
  |---|---|
  | `int` | `'integer'` |
  | `string` | `'varchar(255)'` |
  | `text` | `'text'` |
  | `boolean` | `'boolean'` |
  | `decimal` | `'decimal(10, 2)'` (keep the space after the comma) |
  | `date` | `'date'` |
  | `timestamp` | `'timestamp'` |
  | `uuid` | `'uuid'` |

- `created_at` columns get `.defaultTo(sql\`NOW()\`).notNull()`, the same as in `001_initial_schema.ts`.

### Cardinalities

The FK goes on the table on the "many" or optional side of the relationship.

- **`A ||--o{ B`** (one-to-many): `B` gets a non-unique FK `a_id` that references `a.id`.
- **`A ||--o| B`** (one-to-one): `B` gets FK `a_id` that references `a.id`, with a **unique constraint** (`.unique()`) so each `A` has at most one `B`.
- **Junction tables** (two `||--o{` relationships pointing into one entity, e.g. `BOOK_AUTHORS`): add a unique constraint across both FK columns:
  `.addUniqueConstraint('book_authors_book_id_author_id_unique', ['book_id', 'author_id'])`

## File Output

- Write the migration to `src/db/migrations/<timestamp>_<migration_name>.ts`.
- `<timestamp>` is the current time as `YYYYMMDDHHmmss` (e.g. `20261007153000`). This makes the file sort after `001_initial_schema.ts`, and Kysely runs migrations in filename order.
- `<migration_name>` is a short snake_case summary (e.g. `library_schema`).

## Structure

Every migration must follow this shape:

```ts
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // createTable calls, parents before children
}

export async function down(db: Kysely<any>): Promise<void> {
  // dropTable calls, in reverse dependency order
}
```

- Export both `up(db: Kysely<any>)` and `down(db: Kysely<any>)`.
- In **`up`**, create tables in dependency order: a table must come after every table its FKs reference.
- In **`down`**, drop tables in the **reverse dependency order**: children before parents, the exact reverse of `up`.
- Only import `sql` if it is used.

## Verify

After writing the file, run:

```bash
npm run build
npm run migrate:up
```

If either command fails, fix the migration file and run both commands again. When both succeed, tell the user the migration's file path and list the tables it creates in order.
