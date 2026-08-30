# Third-Party Dependency Provenance: sortablejs

- **Package:** `sortablejs`
- **Runtime Version:** `1.15.7`
- **Repository:** `https://github.com/SortableJS/Sortable`
- **Commit SHA (gitHead):** `031649b8116565e02419e8aa2d252d7d8c82b9da`
- **License:** MIT License
- **Reason Adopted:** Replaces desktop-only HTML5 native drag-and-drop on the Opportunities pipeline board with robust, cross-platform mouse, touch, and pointer drag support across mobile phones, tablets, and desktop browsers.
- **Direct Production Dependencies:** 0 (`dependencies: {}`)
- **Transitive Dependencies:** 0
- **Reviewed Lifecycle Scripts:** None (No `preinstall`, `install`, or `postinstall` shell scripts in published package).
- **Adoption Date:** 2026-08-30
- **Phases:** OSS-1A1, OSS-1A1A
- **TypeScript Declarations:** Supplied by `@types/sortablejs@1.15.9` (exact-pinned dev dependency, DefinitelyTyped provenance, MIT license, zero runtime impact).
- **Architectural Boundary:** Isolated behind WashOps-owned controller `src/ui/opportunities/opportunities_sortable.ts`. SortableJS has zero direct contact with Supabase, API layers, or persistence authority.
- **Accessibility Parity:** Paired with an accessible native semantic `<select>` stage control on every Opportunity card and screen-reader status announcements via `showToast` (`role="status"`, `aria-live="polite"`).
- **Event Delegation:** No inline executable HTML event handlers; the WashOps controller owns both Sortable drag and select change boundaries with rollback on rejection.
