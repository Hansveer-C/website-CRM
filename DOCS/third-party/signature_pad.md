# Third-Party Dependency Provenance: signature_pad

- **Package:** `signature_pad`
- **Runtime Version:** `5.0.5`
- **Repository:** `https://github.com/szimek/signature_pad`
- **Commit SHA (gitHead):** `02d7eca9fb3654b40dc28bf4098f2bade71a7adf`
- **License:** MIT License
- **Reason Adopted:** Provides smooth, touch/pointer-enabled HTML5 canvas signature drawing across mobile phones, tablets, and desktop browsers for customer quote preview approval in WashOps CRM.
- **Direct Production Dependencies:** 0 (`dependencies: {}`)
- **Transitive Dependencies:** 0
- **Reviewed Lifecycle Scripts:** None (No `preinstall`, `install`, or `postinstall` shell scripts in published package).
- **Adoption Date:** 2026-08-30
- **Phase:** OSS-1A2
- **TypeScript Declarations:** Bundled directly in published package (`dist/types/signature_pad.d.ts`), zero runtime footprint.
- **Architectural Boundary:** Isolated strictly behind WashOps-owned controller `src/ui/quotes/quotes_signature.ts`. SignaturePad has zero direct contact with Supabase, API layers, or persistence authority.
- **Accessibility Parity:** Paired with a semantic signer name text input, explicit terms attestation checkbox, clear button, and accessible non-pointer attestation path for keyboard and screen-reader users.
- **Event Delegation & Lifecycle:** Scoped touch-action, canvas DPI `devicePixelRatio` scaling, responsive resize stroke preservation via data points, and deterministic `destroy()` cleanup upon view navigation.
