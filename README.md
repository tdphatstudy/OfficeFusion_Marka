# Marka — Markdown Editor by OfficeFusion

A desktop writing space built with Electron, React and TypeScript.

## Features

- Write mode with tables, task lists, formatting and slash commands.
- CodeMirror Markdown editing with highlighting, undo/redo, line numbers, word wrap, configurable
  indentation, and find/replace.
- Resizable Split view with Markdown and preview, stacked at smaller window widths.
- Sanitized Markdown preview with GFM tables, task lists, footnotes, syntax highlighting and KaTeX.
  Preview parsing runs in a worker, independently of typing.
- Document outline with correct source navigation, including setext and H1–H6 headings.
- New, Open, Save and Save As with unsaved-change protection and visible error feedback.
- Session-isolated IndexedDB draft recovery, including empty edits. Checkpoints run after 600 ms
  idle or at most 5 seconds during continuous typing; normal close awaits a checkpoint.
- Local Save checks the opened revision and stages/fsyncs replacement bytes. External changes keep
  your draft dirty. Windows staged replacements preserve Owner/Group/DACL.
- Read-only range viewer for UTF-8 local/WSL/mounted files above 5 MiB, with 64 KiB pages and byte
  navigation up to 10 GiB. Editable documents stay within a 5 MiB UTF-8 budget.
- Searchable command palette, meeting notes and project brief templates.
- Light/dark/system appearance with a quick theme switch, writing preferences and focus mode.
- Connection Hub for local files, Windows WSL distributions, SSH Linux hosts, network paths and raw
  Markdown URLs, with saved profiles and recent documents.
- A writing-nib brand mark with Light/Dark variants and matching desktop icons.
- Document-focused titlebar, File/Edit/View menus, contextual formatting and a compact outline.
- Bounded HTML, PDF and plain-text export from editing modes; parsing runs in a worker and PDF
  printing runs in a separate script-disabled sandbox.

Documents containing frontmatter, math, footnotes or Mermaid syntax stay in Markdown/Split to
preserve unsupported rich-editor syntax. Mermaid code is preserved as source; diagram rendering is
planned. Files larger than 100,000 characters and embedded/HTML images also use Markdown/Split for
predictable editing performance.

Workspace folders, multi-file tabs, DOCX/EPUB export and OfficeFusion cloud integration are planned.
See [RELIABILITY.md](./RELIABILITY.md) for resource budgets, save semantics and platform limits. See
[UPGRADE_PLAN.md](./UPGRADE_PLAN.md) for the audit, acceptance criteria and next priorities. See
[CONNECTIONS.md](./CONNECTIONS.md) for authentication, file paths, write behavior and limits. See
[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for the desktop interface and brand guidelines.

## Development

Requires Node.js 20.19+ and pnpm 9.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## Validation

```sh
pnpm lint
pnpm typecheck:node
pnpm typecheck:web
pnpm test
pnpm build
pnpm test:smoke
pnpm test:connections
pnpm test:security
node scripts/benchmark-editor.mjs
```

`test` runs regression tests with the Node test runner. `test:smoke` launches the built Electron app
with Playwright, an isolated profile, and real test files under `tmp/electron-smoke/`. Native dialog
responses are automated. Build first; Electron must be able to launch in the current desktop
session. No separate Playwright browser download is needed. Screenshots and export samples are saved
in `tmp/`.

`test:connections` covers theme switching, Connection Hub, URL import and SSH against a localhost
mock server. It generates its own disposable host/client keys and fake passwords, including an
encrypted key fixture; it never reads personal SSH keys or uses remote servers. Remote file reads,
writes and conflicts are simulated by the server. On Windows, set `MARKA_TEST_WSL_DISTRO=Ubuntu` (or
another installed distro) to additionally open/save a generated file in that distro's `/tmp`; the
suite removes that file afterward. No personal documents are used.

## Keyboard shortcuts

Use Command instead of Ctrl on macOS.

| Shortcut                    | Action                                         |
| --------------------------- | ---------------------------------------------- |
| Ctrl+N / Ctrl+O             | New / Open                                     |
| Ctrl+S / Ctrl+Shift+S       | Save / Save As                                 |
| Ctrl+K                      | Command palette                                |
| Ctrl+Shift+C                | Connection Hub                                 |
| Ctrl+F                      | Find/replace in Markdown (switches from Write) |
| Ctrl+Shift+R / Ctrl+Shift+M | Write / Markdown                               |
| Ctrl+\                      | Split view                                     |
| Ctrl+Shift+O                | Toggle outline                                 |
| Ctrl+Shift+F                | Toggle focus mode                              |
| Ctrl+,                      | Editor settings                                |

## Build

```sh
pnpm build
pnpm package:win
pnpm package:mac
pnpm package:linux
```

See [CODESTYLE.md](./CODESTYLE.md) for coding conventions and [QA_REPORT.md](./QA_REPORT.md) for the
validation scope and remaining limitations.

## License

MIT © OfficeFusion Team
