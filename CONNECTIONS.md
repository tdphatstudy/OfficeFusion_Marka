# Connecting your documents to Marka

Open the globe button in the title bar, choose **File → Open connection…**, or press
**Ctrl+Shift+C** (Command+Shift+C on macOS). Files open into the same editor with unsaved-change
protection.

| Method         | What to enter                                                                               | Save behavior                                                      |
| -------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| This computer  | Browse for a Markdown or text file                                                          | Writes to the selected file                                        |
| WSL            | An installed distribution and an absolute Linux path, such as `/home/me/notes.md`           | Writes to the same Linux file through `\\wsl.localhost\Distro\…`   |
| SSH            | Host, username, optional port, verified fingerprint and `/absolute/path.md` or `~/notes.md` | Writes back to the SSH host; Save As creates a local copy          |
| Network / Path | A UNC path such as `\\server\share\notes.md`, a mapped drive, or a mounted path             | Uses your operating system's filesystem and network authentication |
| From URL       | An HTTP(S) raw Markdown/plain-text URL                                                      | Imports a copy; Save always chooses a local file                   |

SSH/URL imports accept UTF-8 text up to 5 MiB and reject binary data. Local, WSL and mounted files
above 5 MiB open in the read-only range viewer (up to 10 GiB); each request reads at most 64 KiB.
Typed local paths require native confirmation before file access. Missing files, permission errors
and connection failures leave the active document intact. Requests have a 30-second deadline; URL
downloads also have a 15-second deadline. **Cancel request** releases the UI without replacing the
active document. A pending operating-system filesystem call can finish later; its result is ignored.

## SSH requirements

- Choose **Password** or **SSH key**. For key authentication, select a private key through the
  native Browse picker and enter its passphrase if encrypted. Marka never discovers default keys,
  uses an SSH agent, reads your SSH config, or launches ProxyCommand/ProxyJump. Direct host
  connections only.
- Enter the server's **SHA256 host fingerprint**, verified independently with its administrator. A
  mismatch is rejected before credentials are sent. Marka does not silently accept host keys or edit
  `known_hosts`. To rotate a server key, verify the new fingerprint independently and update the
  profile; do not bypass a mismatch.
- Passwords and passphrases are kept only in main-process memory, for up to 30 minutes after
  opening. Reloading or closing the renderer clears them. Key contents are read only from the
  explicitly selected file for each operation; they are not persisted. The bundled `ssh2` transport
  does not require a system OpenSSH installation. Keyboard-interactive/MFA and hardware-backed keys
  are not supported in this version.
- The remote filesystem must be on a Linux host with GNU `cat`, `sha256sum`, `mktemp`, `cp` and
  `mv`. Windows SSH servers and BSD-only command sets are not supported for remote writes in this
  version.

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
file; choose the saved entry to fill the form, then enter authentication details. Remove a profile
with its trash button and clear recent documents with **Clear**. URL query parameters can contain
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
