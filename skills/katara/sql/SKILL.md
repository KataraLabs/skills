---
name: sql
description: "Use when writing, changing, reviewing or testing SQL: queries, schema changes, migrations, views, functions or indexes (.sql files, a migrations folder, or SQL inside application code). Covers finding the database and migration tool, query style, safe migrations, testing against a disposable database, and common SQL mistakes."
license: MIT
metadata:
  file-types: "*.sql"
  project-files: "migrations/ schema.sql"
---

# SQL

## Find the project's conventions first

1. Which database and version: PostgreSQL, MySQL/MariaDB, SQLite, SQL Server. Look at the
   connection config, `docker-compose.yml`, or the driver in the dependency file. Syntax and
   locking behavior differ; write for the one in use.
2. The migration tool and its folder: plain numbered `.sql` files, Flyway (`V1__name.sql`),
   Liquibase, Alembic, Django, Rails, Prisma, Drizzle, golang-migrate, sqlx, Atlas. New schema
   changes go through it, never as hand-run statements.
3. Existing migrations: naming, whether each has a down migration, whether they wrap in a
   transaction, how they create indexes.
4. How the application sends queries: an ORM, a query builder, or raw SQL with a
   generator such as sqlc. Write queries the same way.
5. Naming: table names singular or plural, `snake_case` columns, primary key and timestamp
   column names, foreign key naming.

## Query style

- Uppercase keywords or lowercase, as the project does; one clause per line for anything longer
  than a line.
- Name columns in `SELECT` and `INSERT`; no `SELECT *` in application code.
- Always pass values as bound parameters (`$1`, `?`, `:name`). Never build SQL by concatenating
  user input. Identifiers that must vary come from a fixed allow-list.
- Explicit `JOIN ... ON` rather than comma joins. Qualify columns when more than one table is involved.
- Use CTEs (`WITH`) to name steps of a long query.
- Use `EXISTS` for "is there any", and keep `NOT IN` away from nullable columns (a single NULL
  makes it return nothing).
- Paginate with a keyset (`WHERE id > $last ORDER BY id LIMIT n`) for large tables; `OFFSET`
  gets slower the deeper it goes.
- Every `ORDER BY` used for paging must be unique (add the primary key as a tiebreak).
- Check plans with `EXPLAIN` (PostgreSQL: `EXPLAIN ANALYZE` on a copy, since it runs the query).

## Schema and migrations

- One logical change per migration; never edit a migration that has already run anywhere shared.
  Add a new one.
- Constraints belong in the schema: `NOT NULL`, `UNIQUE`, `CHECK`, foreign keys. Do not rely on
  application code alone.
- Money as `numeric`/`decimal` or integer minor units, never floating point. Timestamps with time
  zone (`timestamptz` in PostgreSQL) stored in UTC.
- Index the columns used in frequent `WHERE`, `JOIN` and `ORDER BY` clauses, and foreign keys
  that are queried or deleted through.
- Changes to large or busy tables need care: in PostgreSQL create indexes with
  `CREATE INDEX CONCURRENTLY` (outside a transaction), add `NOT NULL` columns in steps (add
  nullable, backfill in batches, then add the constraint), and avoid rewrites that lock the table.
- Renames and drops break running code. Expand first (add the new column, write to both), deploy,
  then contract (drop the old) in a later migration.
- Destructive migrations (drop, truncate, type changes that lose data) need the user's explicit
  agreement.

## Testing

Run SQL against a disposable database, never a shared or production one. If your agent can run
commands, use the project's own setup (a test container, `docker compose up db`, an in-memory
SQLite, or a test fixture); otherwise give the user the steps.

- Apply every migration from empty, then run the application's database tests.
- If down migrations exist, test up, down, up.
- Test queries with data that hits the edges: NULLs, empty strings, duplicates, time zone
  boundaries, the first and last page.
- For PostgreSQL functions and policies, pgTAP or the application's test suite with a real
  database is better than mocks.

## Common mistakes

- String-built SQL with user input (injection).
- `= NULL` instead of `IS NULL`.
- An `UPDATE` or `DELETE` without a `WHERE`, or with one that matches more than intended. Run the
  `WHERE` as a `SELECT count(*)` first.
- N+1 queries from a loop in application code; fetch in one query with a join or `IN`/`ANY`.
- Missing indexes on foreign keys, causing slow deletes and joins.
- Relying on row order without `ORDER BY`.
- Long transactions that hold locks while doing network calls in application code.
- Changing a migration that already ran, so environments drift.
- Assuming one database's syntax (`ILIKE`, `RETURNING`, `UPSERT` forms) works in another.
