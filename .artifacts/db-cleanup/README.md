# DB Cleanup Runbooks

This folder contains operational runbooks for safely removing test/demo data.

## Runbooks

- [2026-01-09-test-data-cleanup.md](2026-01-09-test-data-cleanup.md)
  - E2E/test jobs/deals/loaners cleanup (transactional, rollback-by-default).
- [2026-01-09-product-keep-list-cleanup.md](2026-01-09-product-keep-list-cleanup.md)
  - Keep only the 6 Priority Lexus VB products and delete all other products (handles `job_parts.product_id` FK first).

## Guardrails

- Always start with DRY RUN queries.
- Always run deletes inside `begin; ... rollback;` first.
- Note: The DB currently includes an `E2E Org` alongside `Priority Lexus VB`; scope your deletes accordingly.
