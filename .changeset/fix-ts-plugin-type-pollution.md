---
'@astrojs/ts-plugin': patch
---

Fixes the TS plugin injecting Astro types (and transitively `@types/node`) into non-Astro projects in hoisted monorepos. The plugin now checks whether the project actually uses Astro before injecting ambient types.
