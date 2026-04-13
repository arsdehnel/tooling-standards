---
paths:
  - "src/handlers/**"
---

# Handler Development

## Interface

```typescript
class MyHandler implements FileHandler {
  async beforePush(content: string, context: PushContext): Promise<PushResult> {
    return {
      content: formattedContent,
      additionalFiles: [{ path, content, reason }],  // optional, bundled into same PR
      warnings: ['...'],                               // optional
    };
  }
}
```

Register in `src/handlers/registry.ts`:
```typescript
handlers.set('my-file.ext', new MyHandler());
```

## Current Handlers

- **BiomeHandler** (`biome.json`) — Extracts version from `$schema` URL, updates `@biomejs/biome` in package.json
- **SemanticReleaseHandler** (`release.config.js`) — Ensures semantic-release plugins are in devDependencies; adds missing ones at latest npm version, leaves existing ones untouched

## Patterns & Gotchas

- Plugin extraction uses **regex** (not eval/dynamic import) — intentional, safe and simple
- Lockfile detection order: `pnpm-lock.yaml` → `package-lock.json` → `yarn.lock` (first found wins)
- Format TS/JS with `formatWithBiome`, package.json with `formatWithPrettier`
- **Version strategy:** handlers never manage versions — only add missing deps (fetch latest from npm via `src/utils/npm-registry.ts`). Version upgrades are handled by Renovate/Dependabot.

## Testing

- Tests in `src/handlers/__tests__/`
- Mock: `fetchFile`, `formatWithBiome`, `formatWithPrettier`, `generateLockfile`, `fetchLatestNpmVersion`
- Cover: happy path, missing files (expect warnings), no-op when deps already present
