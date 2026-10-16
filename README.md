# Marka — Markdown Editor by OfficeFusion

A desktop writing space built with Electron, React and TypeScript.

## Features

- Rich block editing with tables, task lists, formatting and slash commands.
- CodeMirror source editing with Markdown highlighting, undo/redo, line numbers, word wrap,
  configurable indentation, and find/replace.
- Resizable Source + Preview view, with a stacked layout for smaller windows.
- Sanitized Markdown preview with GFM tables, task lists, footnotes, syntax highlighting and KaTeX.
  Preview parsing runs in a worker, independently of typing.
- Document outline with correct source navigation, including setext and H1–H6 headings.
- New, Open, Save and Save As with unsaved-change protection and visible error feedback.
- Local draft recovery, including empty edits. Recovery writes after 600 ms of inactivity and on
  normal unload; use Save to persist the document to disk.
- Searchable command palette, meeting notes and project brief templates.
- Light/dark/system appearance with a quick theme switch, writing preferences and focus mode.
- Connection Hub for local files, Windows WSL distributions, SSH Linux hosts, network paths and raw
  Markdown URLs, with saved profiles and recent documents.
- A new SVG brand mark with matching Windows, macOS and Linux app icons.
- HTML, PDF and plain-text export from every editing mode.

Documents containing frontmatter, math, footnotes or Mermaid syntax stay in Source/Split to preserve
unsupported rich-editor syntax. Mermaid code is preserved as source; diagram rendering is planned.
Files larger than 100,000 characters also use Source/Split for predictable editing performance.

Workspace folders, multi-file tabs, DOCX/EPUB export and OfficeFusion cloud integration are planned.
See [UPGRADE_PLAN.md](./UPGRADE_PLAN.md) for the audit, acceptance criteria and next priorities. See
[CONNECTIONS.md](./CONNECTIONS.md) for authentication, file paths, write behavior and limits.

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

| Shortcut                    | Action                                      |
| --------------------------- | ------------------------------------------- |
| Ctrl+N / Ctrl+O             | New / Open                                  |
| Ctrl+S / Ctrl+Shift+S       | Save / Save As                              |
| Ctrl+K                      | Command palette                             |
| Ctrl+Shift+C                | Connection Hub                              |
| Ctrl+F                      | Find/replace in Source (switches from Rich) |
| Ctrl+Shift+R / Ctrl+Shift+M | Rich / Source                               |
| Ctrl+\                      | Split view                                  |
| Ctrl+Shift+O                | Toggle outline                              |
| Ctrl+Shift+F                | Toggle focus mode                           |
| Ctrl+,                      | Editor settings                             |

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
