# Tooling Standards

A CLI tool for managing and synchronizing configuration files across multiple projects.

## What It Does

This tool helps maintain consistent tooling configurations across all your repositories by:
- **Pulling** config files from remote repos to create/update templates
- **Pushing** template files to remote repos via GitHub PRs
- Providing property-by-property approval for JSON changes
- Handling file-specific logic (e.g., automatically updating package versions)

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up GitHub token:
   ```bash
   export GH_TOKEN_TOOLING_STANDARDS="your-github-token"
   ```

3. Run during development:
   ```bash
   pnpm dev <command>
   ```

## Commands

### `pull` - Pull config from a remote repo

Fetches a configuration file from a GitHub repository and saves it as a template.

```bash
pnpm dev pull <file> -o <owner> -r <repo> [-b <branch>] [-s]

# Examples
pnpm dev pull biome.json -o arsdehnel -r my-project
pnpm dev pull tsconfig.json -o kad-products -r rezept-core -b develop
pnpm dev pull .vscode/settings.json -o arsdehnel -r my-app --save
```

**Options:**
- `<file>` - Config file path to pull (e.g., `biome.json`, `tsconfig.json`)
- `-o, --owner` - GitHub repository owner (required)
- `-r, --repo` - GitHub repository name (required)
- `-b, --branch` - Branch or ref to pull from (default: `main`)
- `-s, --save` - Automatically save without prompting (default: `false`)

**Features:**
- Property-by-property approval for JSON files
- Traditional diff hunks for non-JSON files
- Automatic JSON key sorting for cleaner diffs
- Subdirectory support (e.g., `.vscode/settings.json`)

### `push` - Push template to a remote repo

Pushes a template file to a GitHub repository by creating a PR.

```bash
pnpm dev push <file> -o <owner> -r <repo> [-b <branch>]

# Examples
pnpm dev push biome.json -o arsdehnel -r my-project
pnpm dev push tsconfig.json -o kad-products -r rezept-core
pnpm dev push biome.json -o arsdehnel -r my-app -b custom-branch-name
```

**Options:**
- `<file>` - Template file to push (e.g., `biome.json`, `tsconfig.json`)
- `-o, --owner` - GitHub repository owner (required)
- `-r, --repo` - GitHub repository name (required)
- `-b, --branch` - Custom branch name (default: `arsd-tooling-sync/<filename>`)

**Features:**
- Shows diff before pushing
- Creates or updates PRs automatically
- Handles existing PRs (updates open PRs, recreates closed/merged PRs)
- File-specific handlers for smart updates (see below)

## Supported File Types

### Standard Files

All JSON files are automatically:
- Formatted with biome
- Normalized (keys sorted alphabetically)
- Compared property-by-property

Non-JSON files use traditional line-by-line diffs.

### Special Handlers

Some files have custom logic that runs during `push`:

#### `biome.json`

**Special behavior:**
- Extracts version from `$schema` URL (e.g., `2.4.11`)
- Fetches `package.json` from target repo
- Updates `@biomejs/biome` package version to match schema
- Pushes both `biome.json` and `package.json` in a single PR

**Example:**
```bash
pnpm dev push biome.json -o arsdehnel -r my-project
```

**Result:**
- Creates PR with 2 files:
  - `biome.json` - Updated config
  - `package.json` - Updated to `@biomejs/biome: ^2.4.11`

## Templates Directory

Templates are stored in `src/templates/`:

```
src/templates/
├── biome.json
├── tsconfig.json
└── .vscode/
    └── settings.json
```

## Development

### Type Checking
```bash
pnpm type-check
```

### Formatting
```bash
pnpm format
```

## How It Works

### Pull Workflow
1. Fetches file from GitHub API
2. Compares with existing template (if any)
3. Shows property-by-property diff for JSON
4. Prompts for approval (or auto-saves with `-s`)
5. Saves to `src/templates/`

### Push Workflow
1. Reads template from `src/templates/`
2. Runs file handler (if registered)
3. Formats content (biome for JSON, prettier for package.json)
4. Checks for existing PR on branch
5. Shows diff of changes
6. Prompts for confirmation
7. Creates/updates branch and PR

### File Handlers

File handlers allow custom logic per file type:

```typescript
// src/handlers/biome-handler.ts
export class BiomeHandler implements FileHandler {
  async beforePush(content: string, context: PushContext): Promise<PushResult> {
    // Custom logic here
    return {
      content: formattedContent,
      additionalFiles: [...],  // Optional extra files to push
      warnings: [...],         // Optional warnings to show
    };
  }
}
```

Register handlers in `src/handlers/registry.ts`.

## Future Enhancements

- [ ] Template variants (NextJS, RedwoodJS, etc.)
- [ ] Bulk operations (push to multiple repos)
- [ ] Configuration presets
- [ ] Auto-upgrade tooling versions
