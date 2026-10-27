# Connecting your documents to Marka

Open the globe button in the title bar, choose **File → Open connection…**, or press
**Ctrl+Shift+C** (Command+Shift+C on macOS). Files open into the same editor with unsaved-change
protection.

| Method         | What to enter                                                                      | Save behavior                                                      |
| -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| This computer  | Browse for a Markdown or text file                                                 | Writes to the selected file                                        |
| WSL            | Choose a distribution, then Browse folders; a direct Linux file path is optional   | Writes to the same Linux file through `\\wsl.localhost\Distro\…`   |
| SSH            | Host, username, optional port and verified fingerprint; connect and browse folders | Writes back to the SSH host; Save As creates a local copy          |
| Network / Path | A UNC path such as `\\server\share\notes.md`, a mapped drive, or a mounted path    | Uses your operating system's filesystem and network authentication |
| From URL       | An HTTP(S) raw Markdown/plain-text URL                                             | Imports a copy; Save always chooses a local file                   |

SSH/URL imports accept UTF-8 text up to 5 MiB and reject binary data. Local, WSL and mounted files
above 5 MiB open in the read-only range viewer (up to 10 GiB); each request reads at most 64 KiB.
Typed local paths require native confirmation before file access. Missing files, permission errors
and connection failures leave the active document intact. Requests have a 30-second deadline; URL
downloads also have a 15-second deadline. **Cancel request** releases the UI without replacing the
active document. A pending operating-system filesystem call can finish later; its result is ignored.

## Browse and choose a file

WSL opens at the distribution user's Linux home after native approval. SSH connects using the
entered password or explicitly selected key, verifies the pinned host fingerprint before
authentication, and starts at the remote user's home. Neither flow requires knowing a file path. For
local and mounted/network folders, **Browse a folder**/**Browse folders** uses a native folder
picker; browsing is restricted to that approved root.

The browser provides Home, Up, Back/Forward, breadcrumbs, a name filter for the current folder,
Markdown/all-file filters and hidden-file visibility. Arrow keys move between entries; Enter opens a
folder or file. Selecting a file and choosing **Open selected file** also works. Canceling a file
picker returns to the hub. Switching sources preserves non-secret path drafts for the current dialog
session.

Listings scan at most 10,000 entries, return at most 200 matches per page, and never read file
contents just to list a folder. Symbolic links are not listed; canonical local paths cannot escape
the approved root. Browsing uses a window-owned opaque capability with a 30-minute lifetime and
revokes it on close, reload or renderer crash. Closing the browser releases its authentication; an
opened SSH document retains its separate bounded save session. Recursive folder search, filesystem
watching and a persistent workspace tree are not implemented; the filter searches the current
directory only. A missing result in an exceptionally large directory may be beyond the scan limit,
as indicated in the browser.

## SSH requirements

- Choose **Password** or **SSH key**. For key authentication, select a private key through the
  native Browse picker and enter its passphrase if encrypted. Marka never discovers default keys,
  uses an SSH agent, reads your SSH config, or launches ProxyCommand/ProxyJump. Direct host
  connections only.
- Enter the server's **SHA256 host fingerprint**, verified independently with its administrator. A
  mismatch is rejected before credentials are sent. Marka does not silently accept host keys or edit
  `known_hosts`. To rotate a server key, verify the new fingerprint independently and update the
  profile; do not bypass a mismatch.
- Form secrets stay in memory and are cleared when the dialog closes or a connection succeeds.
  Main-process authentication sessions last at most 30 minutes. Reloading or closing the renderer
  clears them. Key contents are read only from the explicitly selected file for each operation; they
  are not persisted. The bundled `ssh2` transport does not require a system OpenSSH installation.
  Keyboard-interactive/MFA and hardware-backed keys are not supported in this version.
- The remote filesystem must be on a Linux host with GNU `cat`, `sha256sum`, `mktemp`, `cp` and
  `mv`; folder browsing also requires GNU `find` and `head -z`. Windows SSH servers and BSD-only
  command sets are not supported for remote writes in this version.

**Save** compares the server's current bytes with the saved snapshot, uploads into a temporary file
in the same directory, compares again, preserves mode/ownership, and renames the temporary file over
the original. If the file changed, Marka keeps your edits dirty and asks you to reopen or Save As a
local copy. This is optimistic conflict detection, not a server-side transactional lock. A
disconnect after the server commits can leave the save result uncertain; keep your draft and reopen
or save a local copy before resolving it.

Remote writes require an existing regular file and reject symlinks. Replacement changes the file's
inode; preservation of metadata beyond mode/ownership is not guaranteed. Native local/WSL/network
writes now check the opened revision, stage and fsync bytes, preserve supported access controls,
then recheck before rename. See [RELIABILITY.md](./RELIABILITY.md) for platform guarantees and
remaining races.

## WSL and network paths

WSL is available on Windows. Refresh availability after installing a distribution. Use an absolute
Linux path, not `~`, for WSL. Path components must be compatible with Windows UNC access; paths with
`..`, backslashes, alternate-stream syntax or Windows-reserved characters are rejected.

SMB login, mounted SFTP/WebDAV drives and cloud-synced folders work through the operating system.
Marka does not implement separate SMB, SFTP or WebDAV authentication. Establish the mount or network
session first, then use **Network / Path** or **This computer**.

## Profiles, recent documents and recovery

Profiles store a name, endpoint, path and verified server fingerprint on this device. They do not
store key paths, key contents, passwords or passphrases. Save a profile after filling in the target
file, or leave the SSH path empty to save a host connection; choose the saved entry to fill the
form, then enter authentication details. Edit a profile to update its host/fingerprint/path.
Duplicate names are rejected instead of replacing another profile silently. At most 8 profiles can
be saved; adding another requires removing or editing one. Remove a profile with its trash button
and search all 12 recent documents or clear them with **Clear**. URL query parameters can contain
credentials, so query-bearing URLs are neither saved as profiles nor remembered in history; they can
still be imported directly.

Recovered SSH drafts retain their SSH destination and saved snapshot. Choose the matching saved
connection or recent document, enter authentication, and use **Reconnect & keep edits** to restore
authentication without replacing the draft. Saving again performs the server conflict check. **Save
As** switches the document to a local copy, including future saves.

## Brand assets

`resources/icon.svg` is the editable brand source used in the title bar and Connection Hub.
`pnpm gen:icons` exports PNG sizes, ICO and ICNS directly from SVG; `node scripts/create-lockup.mjs`
creates the light/dark wordmarks. Test fixtures, generated profiles and temporary keys under `tmp/`
are excluded from both Git and application packaging.

The filesystem and authentication design follows
[Microsoft's WSL interoperability guidance](https://learn.microsoft.com/en-us/windows/dev-environment/wsl-interop)
and the [ssh2 client API](https://github.com/mscdex/ssh2#client).
