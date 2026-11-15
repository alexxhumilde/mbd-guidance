# Contributing to MBD Guidance

Thank you for helping keep **MBD Guidance** aligned with the latest Discord API v10 and `discord.js` v14+ releases.

## Repository Requirements

- **100% English**: Keep all guides, playbooks, scanner rules, schemas, CLI messages, and documentation in concise, token-efficient English.
- **Zero Runtime Dependencies**: Do not add third-party packages to `dependencies` in `package.json`. Everything must run on **Node.js >= 20** using built-in modules (`node:fs`, `node:path`, `node:child_process`, etc.).
- **Self-Contained Skill Directory**: Any runtime code, schemas, or scripts required by the skill must live under `skills/mbd-guidance/` so `npx skills add` installations remain fully functional offline. Root `bin/`, `src/`, and `scripts/` re-export from `skills/mbd-guidance/`.

## Adding or Updating Guides

1. Add or edit Markdown files inside `skills/mbd-guidance/guides/<category>/<guide-id>.md`.
2. Ensure valid YAML frontmatter containing:
   - `id`: kebab-case slug matching the filename
   - `title`: clear descriptive title
   - `category`: one of `ui-components`, `legacy-migration`, `security`, `architecture`, or `web-integration`
   - `description`: concise 1-sentence summary for BM25 ranking and CLI output
   - `tags`: relevant API symbols and keywords
   - `apiVersion`: target Discord API version (e.g. `v10`)
   - `ecosystems`: supported stacks (e.g. `discord.js v14.28.1+`, `HTTP Interactions`)
3. Add domain synonyms to `skills/mbd-guidance/src/search-engine.mjs` if users search with common abbreviations or legacy terms.

## Adding Static `legacy-scan` Rules

1. Add a new rule entry (`MBD014+`) to `LEGACY_RULES` in `skills/mbd-guidance/src/legacy-scanner.mjs` with:
   - `ruleId`, `severity`, `guideId` (must match an existing guide ID), `description`, `replacement`, `keepWhen`, and `dropWhen`.
   - Deterministic `matchLine` or `matchFile` detection that minimizes false positives.
2. Add positive and negative fixture coverage in `tests/mbd-guidance.test.mjs`.

## Running Tests

Before opening a pull request, verify all unit, CLI, and standalone skill tests pass:

```sh
npm test
```

You can also smoke-test search, retrieval, and scanning locally:

```sh
node ./skills/mbd-guidance/scripts/mbd-guidance.mjs list
node ./skills/mbd-guidance/scripts/mbd-guidance.mjs search "components v2"
node ./skills/mbd-guidance/scripts/mbd-guidance.mjs legacy-scan ./tests --json
```
