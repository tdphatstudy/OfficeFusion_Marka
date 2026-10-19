# Resource budgets and data safety

These controls apply to the 17 October 2026 performance/security update. Native verification is on
Windows with Electron 44.9.0. Limits favor a responsive editor and recoverable drafts.

| Operation                         | Budget / behavior                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Editable text, native/SSH/URL     | 5 MiB UTF-8; reject binary/invalid encoding                                                          |
| Larger local, WSL or mounted file | Read-only viewer up to 10 GiB; 64 KiB byte ranges                                                    |
| Write mode                        | 100,000 characters; embedded/HTML image sources stay in Markdown                                     |
| Preview                           | 256 Ki characters; lines at most 16,384 characters                                                   |
| Export input                      | 512 KiB UTF-8; PDF/HTML render lines at most 16,384 characters                                       |
| Rendered tree                     | 20,000 nodes, depth 100, checked before and after math/highlighting                                  |
| Rendered HTML                     | 2 Mi characters                                                                                      |
| Preview jobs                      | One active, one replaceable latest pending; 5-second deadline                                        |
| Export jobs                       | One per window, two globally; 10-second parsing / 20-second PDF deadline                             |
| Existing export target / output   | At most 32 MiB for revision checking / writes                                                        |
| Outline / live statistics         | Outline pauses above 128 Ki characters, first 500 headings; statistics pause above 256 Ki characters |
| Recovery                          | 32 session records; newest-first metadata; idle 600 ms / maximum wait 5 seconds                      |

Source edits reject transactions exceeding the byte budget before changing the buffer. Write mode
rejects oversized pastes. Preview/outline/statistics limits are visible; the Markdown source stays
available. Full search, editing and export are unavailable in the large-file viewer. UTF-8 ranges
handle codepoint boundaries and short reads; a file change invalidates the view. The 10 GiB offset
boundary is tested using a bounded mock reader, not a real 10 GiB allocation or a hardware/RSS
claim.

## Save and conflicting writers

Opening grants file access to that window. Save verifies the opened device/inode and SHA-256 byte
revision, writes to a same-volume stage, fsyncs it, rechecks the target and authorization, then
renames it. Writes to the same destination serialize within Marka. A detected external edit keeps
the dirty draft and existing disk bytes. Save As / export capture the destination revision after
native selection and before expensive rendering. Reopening after Save rereads the selected target,
including case aliases. Reload/crash/close invalidates native grants and SSH credentials; a
recovered local draft can be saved with **Save a copy**. SSH drafts can reconnect while retaining
their original comparison baseline.

Windows existing-file stages are created empty with the source access descriptor before any draft
bytes are written. Owner/Group/DACL are verified, including a protected owner-only regression
fixture. A bounded, hidden Windows PowerShell helper uses structured stdin, no profile and no shell
path interpolation. If preserving permissions fails, Save fails with the draft intact. WSL/Linux use
GNU `cp --attributes-only --preserve=all`; WSL is tested with a generated Linux `/tmp` document.
macOS existing-file replacement currently fails closed; Save As to a new path remains available
until a metadata adapter is certified. Native macOS/Linux UI and arbitrary network filesystems have
not been validated.

Symlink/hardlink replacement is refused. Existing EFS-encrypted Windows files fail closed instead of
being replaced by an unencrypted stage; encryption-key handling is not implemented or tested.
Supported edits preserve UTF-8 BOM and uniform CRLF. Mixed line endings, owner/ACL policies across
network filesystems, Windows SACL/ADS/EFS, POSIX extended metadata and cross-platform metadata
fidelity are not comprehensively certified.

This is optimistic conflict detection. Another program can write between the final check and rename;
there is no filesystem-wide compare-and-swap or distributed lock. Directory fsync and power-loss
durability are not guaranteed. Cloud-sync providers and remote saves may report an uncertain result
after a disconnect; retain the draft and compare before retrying. Kernel-level network filesystem
calls can outlive the UI cancellation/deadline.

## Trust boundaries and recovery

The renderer uses sandbox, context isolation, no Node integration and a scoped CJS preload. IPC
requires a registered application window, the exact application document URL and its main frame;
benign URL fragments are ignored. Native file grants, page handles, key-picker grants and operation
generations belong to their window; late operations cannot regain authorization after reload or
cross-document navigation. There is no arbitrary read-file API. Permissions/downloads are denied.
CSP blocks frames, objects and external document images. Raw Markdown is sanitized before trusted
math/highlight transforms; KaTeX uses trust=false with finite size/expansion limits. PDF uses a
separate sandboxed, script-disabled, temporary session with no preload or network access. Print
windows and workers are cleaned up on success/error/deadline.

Recovery uses IndexedDB structured records, not synchronous full-document localStorage snapshots.
Normal close awaits a checkpoint. Other sessions' drafts remain separate; deleting this session's
clean record does not delete them. Storage quota/unavailability is surfaced. The newest drafts are
discoverable even with legacy records beyond the retention cap; no automatic eviction silently
deletes an active draft. Restore/discard older records to make capacity available.

The old file-origin draft/preferences migrate through a hidden sandboxed inert page with no
JavaScript, preload or IPC grant. Main reads/copies only allowlisted, validated keys through CDP,
verifies writes, preserves existing destination preferences and retains legacy source storage.
Migration failure shows a retry screen instead of opening a blank editor. The origin migration is
native-tested on Electron44; an Electron33-to44 Chromium database-format upgrade is not certified.

Recovery is local to the OS profile, not encrypted cloud backup or autosave into the original file.
A crash before the latest checkpoint can lose recent input. Local malware running as the same OS
user and compromised system components are outside the renderer threat boundary. Collaboration/CRDT,
version history, merge UI and out-of-core editing are future work.

## Dependency checks

Electron and the packaging tools were upgraded, and all KaTeX consumers resolve to 0.19.0. Packaging
uses a runtime/assets allowlist. The optional CPU-detection addon is omitted; SSH uses its supported
JavaScript fallback, verified against the localhost fixture server. `pnpm audit --prod` reports zero
advisories for the verified lockfile. The complete development tree still reports four findings
(braces, sprintf-js, postcss-selector-parser), including one high finding without an available
upstream fix. These are build/commit-tool dependencies; a production-only audit is not a claim that
the complete toolchain has zero advisories. Recheck before release and avoid using those tool APIs
with untrusted patterns/format strings/selectors.

Run `pnpm test`, `pnpm test:smoke`, `pnpm test:connections`, `pnpm test:security`, and
`node scripts/benchmark-editor.mjs`; see [QA_REPORT.md](./QA_REPORT.md) for measured evidence.
