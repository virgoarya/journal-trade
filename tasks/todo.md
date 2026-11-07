## Task 1: Investigate tab interactivity issue
**Description:** Examine `layout.tsx` and related CSS for potential CSS/z-index conflicts.

**Acceptance criteria:**
- [x] Identify if the tab element is being covered by another element.
- [x] Determine if `pointer-events: none` is causing the issue.

**Verification:**
- [x] Confirm the problematic CSS or z-index/overlay conflict.

**Dependencies:** None.

**Files likely touched:**
- `frontend/src/app/(dashboard)/macro-terminal/layout.tsx`

**Estimated scope:** Small: 1 file

## Task 2: Fix tab interactivity
**Description:** Apply fix (e.g., z-index, pointer-events adjustment) to the tab container in `layout.tsx`.

**Acceptance criteria:**
- [x] Navigation tabs are clickable.

**Verification:**
- [x] Manual check in the browser.

**Dependencies:** Task 1.

**Files likely touched:**
- `frontend/src/app/(dashboard)/macro-terminal/layout.tsx`

**Estimated scope:** Small: 1 file
