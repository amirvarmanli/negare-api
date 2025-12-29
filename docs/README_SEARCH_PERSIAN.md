# Persian Search Improvements (Catalog Products)

This document describes the robust Persian search changes for product search, including normalization, tokenization, optional title tokens, and database indexing.

## Approach
**Chosen approach:** Trigram search (`pg_trgm`) on a normalized text column.

**Why:**
- Supports multi-token AND queries using `ILIKE` with `%token%` while still benefiting from GIN trigram indexes.
- Allows phrase matching with quoted input (`"..."`) via `ILIKE` on normalized text.
- Keeps implementation simple and safe with Prisma parameterization.

## Normalization Rules
Normalization is **search-only** and does not change display text.

Applied rules (both in code and in DB backfill):
- Arabic variants: `ي → ی`, `ك → ک`
- Remove diacritics/harakat
- Normalize ZWNJ/half-space to plain space
- Normalize punctuation and separators to spaces
- Collapse extra whitespace
- Lowercase ASCII characters

Helpers:
- `normalizeFaText(input: string)`
- `tokenizeFaText(input: string)`

## Tokenization & Matching
- Input is normalized and tokenized.
- **AND semantics** across required tokens (all tokens must match).
- Quoted phrases are treated as exact substring matches on the normalized field.
- Persian titles/prefixes ("شهید", "حاج", "سید", …) are **optional** when mixed with non-title tokens.

Examples:
- `بهشتی` → matches normally
- `شهید بهشتی` → token `بهشتی` required; `شهید` optional
- `"شهید محمدحسین بهشتی"` → phrase match required

## Database Changes
Migration: `prisma/migrations/20260304121000_catalog_search_normalized/migration.sql`

Changes:
- `pg_trgm` extension enabled
- `catalog.products.search_text_normalized` added
- Backfill of normalized text for existing rows
- GIN trigram index on `search_text_normalized`

## API Behavior
Endpoint: `GET /catalog/products/search`

- Query is normalized + tokenized
- AND matching across required tokens
- Optional title tokens boost score but do not filter
- Phrase search supported via quotes
- Pagination remains stable with score + secondary sort

## Postman Examples
In the updated collection:
- `Search Products (single term)` → `بهشتی`
- `Search Products (multi-term)` → `شهید بهشتی`
- `Search Products (phrase)` → `"شهید محمدحسین بهشتی"`
- `Search Products (Arabic variants)` → `شهيد كاظم`

## How to Test Locally
1) Apply migrations:
   - `prisma migrate deploy`
2) Create or update a product with Persian title:
   - Title: `شهید محمدحسین بهشتی`
3) Run searches:
   - `GET /catalog/products/search?q=بهشتی`
   - `GET /catalog/products/search?q=شهید بهشتی`
   - `GET /catalog/products/search?q="شهید محمدحسین بهشتی"`
4) Validate that results include the product in each case.

## Performance Notes
- Tokenized `ILIKE` queries use the trigram GIN index on `search_text_normalized`.
- Phrase searches also benefit from the same index.
- Filters (topic/category/tag/author) are applied in the same SQL query to avoid N+1 issues.
