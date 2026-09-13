# Third-Party Dependency Provenance: pdf-lib and Noto Sans

- **Packages:** `pdf-lib@1.17.1`, `@pdf-lib/fontkit@1.1.1`
- **Repositories:** https://github.com/Hopding/pdf-lib and https://github.com/Hopding/fontkit
- **Licenses:** MIT (both packages)
- **Purpose:** DOC-1B2 server-side fixed-layout PDF drawing. No Chromium, HTML execution, or copied application code is used.
- **Font asset:** `src/documents/assets/NotoSans-Regular.ttf`, Noto Sans Regular, SIL Open Font License 1.1, upstream https://github.com/notofonts/noto-fonts, SHA-256 `b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5`.
- **Unicode boundary:** Noto Sans is embedded in every artifact. A glyph the bundled font cannot encode fails generation before upload; it is never silently replaced or dropped.
