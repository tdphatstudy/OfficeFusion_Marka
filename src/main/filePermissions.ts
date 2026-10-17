import { join } from 'node:path'
import { lstat } from 'node:fs/promises'
import { runProcess } from './connections/process'

const copyWindowsAcl = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$env:PSModulePath = [IO.Path]::Combine($PSHOME, 'Modules')
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
if (([IO.File]::GetAttributes($payload.source) -band [IO.FileAttributes]::Encrypted) -ne 0) { throw 'Safe replacement of an EFS-encrypted file is unavailable. Use an explicitly chosen new destination.' }
$sections = [Security.AccessControl.AccessControlSections]::Access -bor [Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Group
$source = Get-Acl -LiteralPath $payload.source
$expected = $source.GetSecurityDescriptorSddlForm($sections)
$stream = [IO.FileStream]::new([string]$payload.stage, [IO.FileMode]::CreateNew, [Security.AccessControl.FileSystemRights]::Read -bor [Security.AccessControl.FileSystemRights]::Write, [IO.FileShare]::None, 4096, [IO.FileOptions]::None, $source)
$stream.Dispose()
$dacl = [Security.AccessControl.FileSecurity]::new()
$dacl.SetSecurityDescriptorSddlForm($expected, [Security.AccessControl.AccessControlSections]::Access)
[IO.File]::SetAccessControl($payload.stage, $dacl)
$actual = (Get-Acl -LiteralPath $payload.stage).GetSecurityDescriptorSddlForm($sections)
if ($actual -ne $expected) { throw 'Destination access controls could not be preserved. Use Save As a new file.' }
`

export function usesWindowsAcl(path: string): boolean {
  return process.platform === 'win32' && !/^\\\\(?:wsl\.localhost|wsl\$)\\/i.test(path)
}

export async function preservePermissions(
  path: string,
  stage: string
): Promise<() => Promise<void>> {
  const before = await lstat(path)
  const wsl = /^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)\\(.+)$/i.exec(path)
  if (usesWindowsAcl(path)) {
    await runProcess(
      join(
        process.env.SystemRoot ?? 'C:\\Windows',
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe'
      ),
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(copyWindowsAcl, 'utf16le').toString('base64')
      ],
      { input: JSON.stringify({ source: path, stage }), maxBytes: 4096, timeoutMs: 10_000 }
    )
  } else {
    const args = ['--attributes-only', '--preserve=all', '--no-dereference', '--', path, stage]
    if (wsl) {
      const stageParts = /^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)\\(.+)$/i.exec(stage)
      if (!stageParts || stageParts[1] !== wsl[1]) {
        throw new Error('Staging must remain on the same WSL distribution.')
      }
      args.splice(
        -2,
        2,
        `/${wsl[2]?.replaceAll('\\', '/')}`,
        `/${stageParts[2]?.replaceAll('\\', '/')}`
      )
      await runProcess(
        join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'wsl.exe'),
        ['--distribution', wsl[1] ?? '', '--exec', 'cp', ...args],
        { maxBytes: 4096, timeoutMs: 10_000 }
      )
    } else if (process.platform === 'linux') {
      await runProcess('/bin/cp', args, { maxBytes: 4096, timeoutMs: 10_000 })
    } else {
      throw new Error(
        'Preserving existing file access controls is unavailable on this platform. Save As a new file.'
      )
    }
  }
  return async () => {
    const after = await lstat(path)
    if (
      before.ctimeMs !== after.ctimeMs ||
      before.ino !== after.ino ||
      before.mode !== after.mode ||
      before.uid !== after.uid ||
      before.gid !== after.gid
    ) {
      throw new Error('File permissions or metadata changed during Save. Your draft is safe.')
    }
  }
}
