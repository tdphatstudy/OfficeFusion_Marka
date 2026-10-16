# Marka — document editor design

Marka serves office and technical users in OfficeFusion. A shared document shell keeps writing,
Markdown and remote file workflows in the same product. These rules currently apply to Marka; reuse
across other OfficeFusion apps is proposed until their brand assets and interfaces can be compared.

## Research and direction

The design was informed by official product interfaces and guidance, plus an audit of Marka's source
and running screenshots. This was desk research, not a user study.

- [ONLYOFFICE's interface](https://helpcenter.onlyoffice.com/docs/userguides/document_editor/programinterface.aspx)
  provides a useful model for separating document commands, content, navigation and status.
- [Typora](https://typora.io/) and [iA Writer](https://ia.net/writer) provide writing-focused
  counterparts: content should remain central, with navigation and controls serving the document.
- [VS Code's UX guidance](https://code.visualstudio.com/api/ux-guidelines/overview) informs action
  scope and contextual controls. Marka should retain its productivity-editor identity.
- [Microsoft's app icon guidance](https://learn.microsoft.com/en-us/windows/apps/design/iconography/app-icon-design)
  favors a clear metaphor, strong silhouette, few details and legibility at small sizes.

## Brand mark

The selected direction is a downward-facing editorial nib: a physical writing tool representing
creation and editing. Its direction can suggest “mark/down”; it is not a standardized Markdown
symbol. The metaphor follows the emphasis on readable, editable text in
[Markdown's original description](https://daringfireball.net/projects/markdown/syntax).

- `resources/icon.svg` is the editable source on a 64-unit grid. It has a navy body, a restrained
  copper collar and genuinely transparent counters. No letter monogram, heading glyph or outer tile
  is required to hold the shape.
- `resources/icon-dark.svg` uses the same geometry with a light body for dark application chrome.
- `pnpm gen:icons` exports PNG, ICO and ICNS. Native exports add a subtle material keyline to the
  same contour for variable desktop backgrounds, with more weight at small sizes.
- `node scripts/create-lockup.mjs` generates wordmarks from the appropriate Light/Dark mark. The
  brand's material accent does not replace semantic action, error or selection colors.

## Interface hierarchy

1. The titlebar identifies the app and current document, including dirty state and window controls.
2. Menus organize real file, edit and view commands. File actions use the existing guarded flow; no
   placeholder collaboration, workspace or cloud controls should imply unsupported features.
3. The document toolbar keeps Write / Markdown / Split visible. Formatting belongs to the mounted
   writing editor; source actions must route to the active Markdown editor.
4. Outline supports heading navigation. Avoid repeating the full file location in several panels.
5. The writing canvas is continuous and constrained for reading. A paper-like surface does not imply
   A4, page breaks or pagination.
6. Status describes saves, edits, location and encoding truthfully. Remote files identify their
   destination; imported URLs remain local copies.

## Interaction and presentation

- Use the platform UI font, sentence case, descriptive labels and a restrained semantic palette.
  Document typography remains a user preference.
- Keep focus and selection distinguishable beyond color. Menus must restore focus, and toolbar
  actions must preserve the current editor selection.
- Light/Dark preserve hierarchy and geometry. System appearance follows OS changes. Review text
  contrast on normal, raised and selected surfaces, including filled actions and errors.
- At 800×600, retain mode labels and access to commands. Secondary formatting can move into
  overflow; document content and keyboard access must remain intact. Split stacks vertically at
  narrow widths using the existing behavior.
- Keep document guards, recovery, snapshots, connection authentication and shortcuts intact during
  presentation changes. Validate real writing, Markdown, file and connection tasks before release.

Visual review supports design decisions; it does not establish operational or enterprise readiness.
