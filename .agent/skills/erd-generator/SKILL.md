---
name: erd-generator
description: Converts domain requirements into a validated Mermaid Entity-Relationship Diagram (erDiagram) and renders it to an SVG. Use when the user asks to design, draft, or update an ERD, entity-relationship diagram, data model, database schema, or architecture/database diagram, or describes a domain (e.g. "a library system with users, books, loans") that needs to be modeled as tables and relationships.
---

# ERD Generator

Turn an unstructured domain description into a verified Mermaid `erDiagram`, saved to `docs/architecture/schema.mmd` and rendered to `docs/architecture/erd.svg`.

## Rules

- Never present an ERD to the user until the render script has printed `SUCCESS`.
- Always write the diagram to `docs/architecture/schema.mmd`. Never write it anywhere else.
- Never edit `scripts/render_erd.js` or hand-write `docs/architecture/erd.svg` to get past an error. Fix the Mermaid source instead.
- Check `src/db/migrations/` for tables that already exist (e.g. `users`). Include them in the diagram so relationships to them are shown, and keep their existing column names and types.

## Execution Workflow

### 1. Parse the domain requirements

Before writing any Mermaid, list out:

- **Entities**: one per table. Use UPPER_SNAKE_CASE plural names (e.g. `USERS`, `BOOK_AUTHORS`).
- **Primary keys (`PK`)**: every entity gets exactly one, normally `int id PK`.
- **Foreign keys (`FK`)**: name them `<singular_parent>_id` (e.g. `user_id`) and give them the same type as the parent's PK.
- **Cardinalities**: decide the relationship for every entity pair that is related:
  - `||--o{` one-to-many (parent to zero or more children)
  - `||--|{` one-to-many where at least one child is required
  - `||--o|` one-to-one (child FK is unique)
  - Many-to-many: never draw `}o--o{`. Add a junction entity (e.g. `BOOK_AUTHORS`) with two FKs and two `||--o{` relationships.
- **Attributes**: give each one a type of `int`, `string`, `text`, `boolean`, `decimal`, `date`, or `timestamp`. Add `UK` for unique columns.

If the requirements are ambiguous (e.g. whether a book can have multiple authors), pick the most common business rule, state the assumption in the attribute comment or your final response, and continue.

### 2. Write the Mermaid syntax

Write the diagram directly to `docs/architecture/schema.mmd`. The file contains only raw Mermaid with no ```` ``` ```` fences. Follow this template:

```
erDiagram
    USERS ||--o{ LOANS : "places"
    BOOKS ||--o{ LOANS : "is borrowed in"

    USERS {
        int id PK
        string email UK
        timestamp created_at
    }
    LOANS {
        int id PK
        int user_id FK
        int book_id FK
        date due_date
    }
```

Syntax rules that often break rendering:

- Each attribute line is `type name [PK|FK|UK] ["comment"]`. Combine keys with a comma: `int user_id PK, FK`.
- Types and names cannot contain spaces, parentheses, or commas. Use `decimal`, not `decimal(10,2)`.
- Relationship labels go after a colon and must be quoted if they contain spaces: `A ||--o{ B : "has many"`.
- Entity names cannot contain spaces or hyphens.

### 3. Validate and render

From the repository root, run:

```bash
node .agent/skills/erd-generator/scripts/render_erd.js docs/architecture/schema.mmd
```

This is the same script as `node scripts/render_erd.js docs/architecture/schema.mmd` when run from the skill directory. It works from either location.

- Output `SUCCESS` and exit code `0` means `docs/architecture/erd.svg` was generated. Go to step 5.
- Output `SYNTAX_ERROR: <trace>` and exit code `1` means rendering failed. Go to step 4.

### 4. Self-correction loop (up to 3 retries)

If the script prints `SYNTAX_ERROR`:

1. Read the trace. Mermaid parse errors give a line number and show the token they expected versus the one they got (e.g. `Parse error on line 7 ... Expecting 'ATTRIBUTE_WORD', got '('`).
2. Open `docs/architecture/schema.mmd`, find that line, and fix the cause using the syntax rules in step 2. Fix only what is broken and keep the data model the same.
3. Re-run the command from step 3.

Repeat up to **3 retries**. If it still fails after the third retry, stop. Show the user the last error trace and the current contents of `schema.mmd`, and explain what you tried. Do not claim the diagram rendered.

### 5. Final output

When the script prints `SUCCESS`, reply to the user with:

1. The raw Mermaid source from `docs/architecture/schema.mmd`, in a fenced ```` ```mermaid ```` block.
2. The path to the rendered image: `docs/architecture/erd.svg`.
3. A short list of the business assumptions you made (cardinalities, junction tables, optional and required relationships).
4. How many self-correction retries were needed, if any.
