# Marka — Professional Markdown Editor

> Part of the [OfficeFusion](https://github.com/officefusion) ecosystem.

A powerful, cross-platform Markdown editor built with Electron, React, and TypeScript.

## Features

- 📝 Full Markdown editing with CodeMirror 6
- 👁️ Live preview with remark/rehype pipeline
- 🎨 GFM, LaTeX math, Mermaid diagrams, footnotes
- 🌓 Light/Dark theme
- 📁 Workspace-based file management
- 📤 Export to HTML, PDF, DOCX
- ⚡ Fast, cross-platform (Windows, macOS, Linux)

## Development

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
npm install
npm run dev
```

### Build

```bash
# Build for current platform
npm run package

# Platform-specific
npm run package:win
npm run package:mac
npm run package:linux
```

### Scripts

| Command             | Description               |
| ------------------- | ------------------------- |
| `npm run dev`       | Start dev server with HMR |
| `npm run build`     | Build for production      |
| `npm run lint`      | Run ESLint                |
| `npm run format`    | Format with Prettier      |
| `npm run typecheck` | Type-check all            |

## Code Style

See [CODESTYLE.md](./CODESTYLE.md) for coding conventions.

## License

MIT © OfficeFusion Team
