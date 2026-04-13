# Tooling Standards

CLI tool for managing and synchronizing configuration files across repos. Pull configs from repos → templates, push templates to repos via PRs.

## Commands

```bash
pnpm dev <command>           # Run in dev mode
pnpm test                    # Run tests (vitest)
pnpm type-check              # TypeScript check
pnpm format                  # biome + prettier

pnpm dev pull <file> -o <owner> -r <repo>   # Pull config → template
pnpm dev push <file> -o <owner> -r <repo>   # Push template → PR
pnpm dev scan <file>                        # Check repos for compliance
```

## Architecture

- `src/cli.ts` — Yargs CLI (pull/push/scan)
- `src/handlers/` — Per-file-type logic; register in `registry.ts`
- `src/templates/` — Source of truth for config files

**Current handlers:**
- `BiomeHandler` (`biome.json`) — Extracts version from `$schema`, updates `@biomejs/biome` in package.json
- `SemanticReleaseHandler` (`release.config.js`) — Extracts plugins via regex, updates package.json deps + lockfile

**Handler interface:** implement `beforePush(content, context): PushResult` — can return `additionalFiles` (bundled into same PR) and `warnings`.

## tooling-standards.yaml Schema

```yaml
repositories:        # repos to manage, owner/repo format
  - arsdehnel/my-app
  - org/another-repo
```

## Conventions

- **Commits:** Conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:`)
- **Diffs:** "current" (repo's version) vs "new" (template version)
- **Terminology:** "template" (our config) vs "existing" (repo's config)
- **Formatting:** biome for TS/JS/JSON; prettier for package.json and CSS only
- **Tests:** Vitest, in `src/**/__tests__/`; mock `fetchFile`, formatters, and lockfile utils

## Environment

- `GH_TOKEN_TOOLING_STANDARDS` — GitHub API token (required)
- Package manager: pnpm
