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

## Patterns & Gotchas

- Plugin extraction uses **regex** (not eval/dynamic import) — intentional, safe and simple
- Lockfile detection order: `pnpm-lock.yaml` → `package-lock.json` → `yarn.lock` (first found wins)
- Format TS/JS with `formatWithBiome`, package.json with `formatWithPrettier`

## Testing

- Tests in `src/handlers/__tests__/`
- Mock: `fetchFile`, `formatWithBiome`, `formatWithPrettier`, `generateLockfile`
- Cover: happy path, missing files (expect warnings), no-op when versions already match
