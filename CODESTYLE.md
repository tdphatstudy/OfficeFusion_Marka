# Marka — Code Style Guide

> Nguyên tắc coding cho toàn bộ codebase. Áp dụng cho mọi contributor và AI assistant.

## 1. TypeScript

### Strict Mode

- **Luôn** dùng TypeScript strict mode — không tắt bất kỳ check nào
- **Không** dùng `any` — dùng `unknown` rồi narrow, hoặc define type cụ thể
- **Không** dùng `as` cast trừ khi không có cách nào khác
- **Không** viết comment trong code — code phải tự giải thích

```ts
function isMyType(x: unknown): x is MyType {
  return typeof x === 'object' && x !== null && 'id' in x
}
```

### Types & Interfaces

- Dùng `type` cho union types, mapped types, utility types
- Dùng `interface` cho object shapes có thể extend
- Export types với `export type` (không mix với value exports)

```ts
export type Theme = 'light' | 'dark' | 'system'
export type FileStatus = 'saved' | 'modified' | 'new'

export interface EditorConfig {
  fontSize: number
  lineHeight: number
  wordWrap: boolean
  theme: Theme
}
```

### Imports

- Imports phải có order: Node built-ins → third-party → internal
- Dùng `import type` cho type-only imports
- Path aliases: `@/` cho renderer, `@main/` cho main process

```ts
import { join } from 'path'
import { useEffect, useState } from 'react'
import type { FC, ReactNode } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import type { EditorConfig } from '@/types/editor'
```

---

## 2. React

### Component Patterns

- **Functional components only** — không dùng class components
- Type với `FC<Props>` cho components có props; bare function nếu không có props
- Props interface đặt ngay trên component, prefix với component name

```tsx
// ✅ Pattern
interface ToolbarButtonProps {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}

const ToolbarButton: FC<ToolbarButtonProps> = ({ icon, label, onClick, disabled = false }) => {
  return (
    <button aria-label={label} disabled={disabled} onClick={onClick} className="...">
      {icon}
    </button>
  )
}

export { ToolbarButton }
```

### Hooks

- Custom hooks prefix `use`, đặt trong `src/renderer/hooks/`
- Return tuple `[value, setter]` hoặc object (khi nhiều hơn 2 giá trị)
- Không đặt side effects phức tạp trực tiếp trong component — extract vào custom hook

### State — Zustand

- Mỗi domain = 1 store file trong `src/renderer/stores/`
- Store dùng `immer` middleware nếu state nested phức tạp
- Selector functions để tránh re-render không cần thiết

```ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface EditorState {
  content: string
  filePath: string | null
  isDirty: boolean
  setContent: (content: string) => void
}

export const useEditorStore = create<EditorState>()(
  immer(set => ({
    content: '',
    filePath: null,
    isDirty: false,
    setContent: content =>
      set(state => {
        state.content = content
        state.isDirty = true
      })
  }))
)
```

---

## 3. File & Folder Structure

```
src/renderer/
  components/
    ui/
    editor/
    preview/
    layout/
  hooks/
  stores/
  lib/
    markdown/
    utils/
  styles/
  types/
```

### Naming Conventions

| Loại           | Convention               | Ví dụ               |
| -------------- | ------------------------ | ------------------- |
| Component file | PascalCase               | `ToolbarButton.tsx` |
| Hook file      | camelCase                | `useEditorState.ts` |
| Store file     | camelCase + Store suffix | `editorStore.ts`    |
| Utility file   | camelCase                | `markdownUtils.ts`  |
| Type file      | camelCase                | `editor.ts`         |
| CSS file       | kebab-case               | `globals.css`       |

---

## 4. Electron-specific

### IPC Rules

- **Không** expose `ipcRenderer` trực tiếp ra renderer
- Tất cả IPC phải qua preload context bridge với typed API
- Handler trong `src/main/ipc/` — mỗi domain 1 file
- Dùng `ipcMain.handle` (invoke/handle pattern) cho request-response
- Dùng `ipcMain.on` / `webContents.send` cho one-way events

```ts
import { ipcMain, dialog } from 'electron'
import { readFile } from 'fs/promises'

export function registerFileIpc(): void {
  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'Markdown', extensions: ['md', 'mdx', 'markdown'] }],
      properties: ['openFile']
    })
    if (canceled) {
      return null
    }
    const targetPath = filePaths[0]
    if (!targetPath) {
      return null
    }
    const content = await readFile(targetPath, 'utf-8')
    return { path: targetPath, content }
  })
}
```

### Security

- `contextIsolation: true` — bắt buộc
- `nodeIntegration: false` — bắt buộc
- `sandbox: true` — bắt buộc; preload đóng gói CommonJS, chỉ dùng API IPC được hỗ trợ trong sandbox
- CSP header trong HTML entry

---

## 5. Styling — Tailwind + CSS Variables

- Design tokens được định nghĩa trong CSS variables (`globals.css`)
- Không hardcode màu sắc trong Tailwind — dùng token classes (`text-text-primary`, `bg-surface`)
- Dark mode qua class `.dark` trên `<html>` element
- Component variants dùng `class-variance-authority` (cva)

```tsx
<div className="bg-surface border border-border rounded-lg p-4">
  <h2 className="text-text-primary font-semibold">Title</h2>
  <p className="text-text-secondary text-sm">Description</p>
</div>
```

---

## 6. Commit Convention

Theo **Conventional Commits** (https://www.conventionalcommits.org):

```
<type>(<scope>): <short summary>

Types: feat | fix | docs | style | refactor | perf | test | chore | build
Scope: editor | preview | ipc | ui | store | config | deps

Examples:
feat(editor): add CodeMirror 6 integration
fix(preview): resolve math rendering with KaTeX
chore(deps): update electron to 33.2.1
refactor(store): migrate to Zustand immer middleware
```

---

## 7. Zero-Comment Policy (Tuyệt đối không comment)

- **Cấm hoàn toàn mọi hình thức comment trong mã nguồn** (`//`, `/* */`, JSDoc).
- Đã được enforce tự động bằng rule ESLint: `no-comments/disallow-comments` ở mức `error`. Bất kỳ
  comment nào xuất hiện trong `src/` đều khiến linter và pre-commit hook fail ngay lập tức.
- **Nguyên tắc Self-Explanatory Code**:
  - Đặt tên định danh (identifier) rõ ràng, tường minh thể hiện mục đích.
  - Tách hàm nhỏ theo Single Responsibility Principle thay vì viết khối code dài và dùng comment
    giải thích.
  - Sử dụng hệ thống Type an toàn của TypeScript để tự làm tài liệu.
  - Mọi ghi chú tiến độ hoặc thiết kế kiến trúc phải nằm ở tài liệu riêng trong `docs/`, không đưa
    vào file mã nguồn.
