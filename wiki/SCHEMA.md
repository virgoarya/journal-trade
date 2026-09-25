# Wiki Schema

## Domain
Journal Trade Framework – architecture, data pipelines, AI review patterns, trading strategies, MT5 integration, and operational procedures.

## Conventions
- File names: lowercase, hyphens, no spaces (e.g., `ict-strategy.md`).
- Every wiki page starts with YAML frontmatter (see template below).
- Use `[[wikilinks]]` to link between pages (minimum 2 outbound links per page).
- When updating a page, bump the `updated` date.
- Every new page must be added to `index.md` under the correct section.
- Every action must be appended to `log.md`.
- Provenance markers: on pages that synthesize ≥3 sources, append `^[raw/articles/<source>.md]` to paragraphs whose claims come from a specific source.

## Frontmatter Template
```yaml
---
title: Page Title
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: entity | concept | comparison | query | summary
tags: [tag1, tag2]
sources: [raw/articles/source-name.md]
confidence: high | medium | low   # optional
contested: true                     # optional, when claims conflict
contradictions: [other-page-slug]    # optional
---
```

## Tag Taxonomy
- **Framework**: architecture, pipeline, module, integration
- **Strategy**: ict, smc, msnr, signal, pattern
- **Data**: market-data, mt5, tick, candle, cache, macro
- **Process**: ingest, sync, query, lint, update, consensus
- **Quality**: confidence, contested, review
- **Tooling**: node, electron, nextjs, mongodb, python, ai, memory

Use only tags from this list; add new tags to this section before using them.
