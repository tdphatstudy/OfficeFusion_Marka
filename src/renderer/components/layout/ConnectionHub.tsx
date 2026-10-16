import { useEffect, useState, type FC, type FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  FolderOpen,
  Terminal,
  Server,
  Globe,
  Network,
  X,
  RefreshCw,
  ArrowRight,
  Trash2,
  Loader2,
  BookmarkPlus,
  Clock
} from 'lucide-react'
import { fileActions } from '@/lib/fileActions'
import { useConnectionStore } from '@/stores/connectionStore'
import { useUIStore } from '@/stores/uiStore'
import { useEditorStore } from '@/stores/editorStore'
import {
  parseTarget,
  targetLabel,
  wslPath,
  type ConnectionCapabilities,
  type SshCredentials,
  type ConnectionTarget
} from '../../../shared/connections'

type ConnectionKind = 'local' | 'wsl' | 'ssh' | 'network' | 'url'

const methods = [
  { id: 'local', title: 'This computer', subtitle: 'Browse local files', icon: FolderOpen },
  { id: 'wsl', title: 'WSL', subtitle: 'Linux on Windows', icon: Terminal },
  { id: 'ssh', title: 'SSH', subtitle: 'Remote Linux files', icon: Server },
  { id: 'network', title: 'Network / Path', subtitle: 'SMB, UNC or mounted drive', icon: Network },
  { id: 'url', title: 'From URL', subtitle: 'Import Markdown or text', icon: Globe }
] satisfies { id: ConnectionKind; title: string; subtitle: string; icon: typeof FolderOpen }[]

const connectionHints: Record<ConnectionKind, { placeholder: string; help: string }> = {
  local: { placeholder: '', help: '' },
  wsl: {
    placeholder: '/home/me/notes.md',
    help: 'Use an absolute Linux path such as /home/me/notes.md. Save writes back to the same WSL file.'
  },
  ssh: {
    placeholder: '/home/me/notes.md or ~/notes.md',
    help: 'Open an existing UTF-8 file on a Linux host with GNU coreutils, up to 5 MB. Save writes back to SSH; Save As makes a local copy.'
  },
  network: {
    placeholder: '\\\\server\\share\\notes.md or /mounted/share/notes.md',
    help: 'Use an existing local or network path. Network authentication is managed by your operating system.'
  },
  url: {
    placeholder: 'https://example.com/notes.md',
    help: 'Imports a local copy, up to 5 MB. Use a raw text URL; Save never writes back to the website.'
  }
}

const ConnectionForm: FC = () => {
  const [kind, setKind] = useState<ConnectionKind>('local')
  const [capabilities, setCapabilities] = useState<ConnectionCapabilities | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [path, setPath] = useState('')
  const [distribution, setDistribution] = useState('')
  const [host, setHost] = useState('')
  const [username, setUsername] = useState('')
  const [port, setPort] = useState('')
  const [authMethod, setAuthMethod] = useState<'password' | 'key'>('password')
  const [password, setPassword] = useState('')
  const [identityFile, setIdentityFile] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [fingerprint, setFingerprint] = useState('')
  const [profileName, setProfileName] = useState('')
  const busy = useUIStore(state => state.fileBusy)
  const profiles = useConnectionStore(state => state.profiles)
  const recent = useConnectionStore(state => state.recent)
  const currentPath = useEditorStore(state => state.filePath)
  const hint = connectionHints[kind]
  let actionLabel = kind === 'url' ? 'Import document' : 'Open document'
  if (busy) {
    actionLabel = 'Opening…'
  }

  const refresh = async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.api.connectionCapabilities()
      setCapabilities(result)
      setDistribution(current =>
        result.wslDistributions.includes(current) ? current : (result.wslDistributions[0] ?? '')
      )
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not inspect connections.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    useUIStore.getState().dismissNotice()
    void refresh()
  }, [])

  const getTarget = (): ConnectionTarget => {
    if (kind === 'ssh') {
      return parseTarget({
        kind: 'ssh',
        host: host.trim(),
        path: path.trim(),
        username: username.trim() || undefined,
        port: port ? Number(port) : undefined,
        fingerprint: fingerprint.trim() || undefined
      })
    }
    if (kind === 'url') {
      return parseTarget({ kind: 'url', url: path.trim() })
    }
    return parseTarget({
      kind: 'local',
      path: kind === 'wsl' ? wslPath(distribution, path.trim()) : path.trim()
    })
  }
  const connect = async (
    target: ConnectionTarget,
    fromForm = false,
    keepEdits = false
  ): Promise<void> => {
    if (target.kind === 'ssh' && !fromForm) {
      setKind('ssh')
      setHost(target.host)
      setUsername(target.username ?? '')
      setPort(target.port ? String(target.port) : '')
      setPath(target.path)
      setFingerprint(target.fingerprint ?? '')
      setPassword('')
      setIdentityFile('')
      setPassphrase('')
      setError('Enter authentication details to reopen this SSH connection.')
      return
    }
    setError('')
    useUIStore.getState().dismissNotice()
    let credentials: SshCredentials | undefined
    if (target.kind === 'ssh') {
      credentials =
        authMethod === 'password'
          ? { method: 'password', password }
          : { method: 'key', keyPath: identityFile, passphrase: passphrase || undefined }
    }
    const opened = keepEdits
      ? await fileActions.reconnectTarget(target, credentials)
      : await fileActions.openTarget(target, credentials)
    setPassword('')
    setPassphrase('')
    if (opened) {
      useUIStore.getState().setConnectionsOpen(false)
    } else {
      const notice = useUIStore.getState().notice
      if (notice?.error) {
        setError(notice.message)
        useUIStore.getState().dismissNotice()
      }
    }
  }
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    try {
      void connect(getTarget(), true)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Check the connection details.')
    }
  }
  const saveProfile = (): void => {
    try {
      useConnectionStore.getState().saveProfile(profileName, getTarget())
      setProfileName('')
      setError('')
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Check the connection details.')
    }
  }
  const chooseFile = async (): Promise<void> => {
    const selected = await window.api.chooseConnectionKey().catch(() => null)
    if (selected) {
      setIdentityFile(selected)
    }
  }
  let canReconnect = false
  try {
    canReconnect = kind === 'ssh' && targetLabel(getTarget()) === currentPath
  } catch {
    canReconnect = false
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <div>
            <Dialog.Title className="text-base font-semibold">Open document</Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-text-secondary">
              Select a local file, remote host, or network location.
            </Dialog.Description>
          </div>
        </div>
        <Dialog.Close aria-label="Close connections" className="icon-button" disabled={busy}>
          <X size={18} />
        </Dialog.Close>
      </div>
      <div className="connection-layout grid grid-cols-[185px_minmax(0,1fr)]">
        <div
          className="border-r border-border bg-surface-raised p-3"
          role="group"
          aria-label="Connection methods"
        >
          {methods.map(method => (
            <button
              key={method.id}
              type="button"
              disabled={busy}
              aria-pressed={kind === method.id}
              onClick={() => {
                setKind(method.id)
                setPassword('')
                setPassphrase('')
                setPath('')
                setError('')
              }}
              className={`mb-1 flex w-full items-center gap-2 rounded-sm border-l-2 px-3 py-2 text-left transition-colors disabled:opacity-50 ${kind === method.id ? 'border-accent bg-surface-overlay text-text-primary' : 'border-transparent text-text-secondary hover:bg-surface-overlay'}`}
            >
              <method.icon size={17} className="shrink-0" />
              <span>
                <span className="block text-xs font-semibold">{method.title}</span>
                <span className="mt-1 block text-[10px] text-text-muted">{method.subtitle}</span>
              </span>
            </button>
          ))}
          <button
            type="button"
            className="mt-3 flex items-center gap-2 px-3 text-[11px] text-text-muted hover:text-accent"
            onClick={() => {
              void refresh()
            }}
            disabled={loading || busy}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Checking…' : 'Refresh availability'}
          </button>
        </div>
        <div className="min-w-0 p-5">
          <form onSubmit={submit} className="space-y-4">
            {kind === 'local' ? (
              <div className="py-1">
                <h3 className="text-sm font-semibold">Open from this computer</h3>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                  Open Markdown and text files. Mapped network drives and cloud folders synced to
                  this computer work here too.
                </p>
                <button
                  type="button"
                  className="primary-action mt-4"
                  disabled={busy}
                  onClick={() => {
                    void fileActions.open().then(() => {
                      if (!useUIStore.getState().notice?.error) {
                        useUIStore.getState().setConnectionsOpen(false)
                      }
                    })
                  }}
                >
                  <FolderOpen size={15} />
                  Browse files
                </button>
              </div>
            ) : (
              <>
                {kind === 'wsl' && (
                  <>
                    <label className="connection-field">
                      Linux distribution
                      <select
                        aria-label="Linux distribution"
                        value={distribution}
                        onChange={event => setDistribution(event.target.value)}
                        disabled={busy || loading}
                      >
                        <option value="">
                          {loading ? 'Looking for WSL…' : 'Choose a distribution'}
                        </option>
                        {capabilities?.wslDistributions.map(name => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {capabilities?.platform !== 'win32' && capabilities && (
                      <p className="connection-help">
                        WSL is available on Windows. Use This computer to open Linux files on this
                        device.
                      </p>
                    )}
                    {capabilities?.wslError && (
                      <p className="connection-help">{capabilities.wslError}</p>
                    )}
                  </>
                )}
                {kind === 'ssh' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="connection-field">
                        Host
                        <input
                          value={host}
                          onChange={event => setHost(event.target.value)}
                          placeholder="dev.example.com"
                          required
                          disabled={busy}
                          autoComplete="off"
                        />
                      </label>
                      <label className="connection-field">
                        Username
                        <input
                          value={username}
                          onChange={event => setUsername(event.target.value)}
                          placeholder="me"
                          required
                          disabled={busy}
                          autoComplete="off"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
                      <label className="connection-field">
                        Port
                        <input
                          value={port}
                          onChange={event => setPort(event.target.value)}
                          type="number"
                          min="1"
                          max="65535"
                          placeholder="22"
                          disabled={busy}
                        />
                      </label>
                      <label className="connection-field">
                        Authentication
                        <select
                          aria-label="Authentication"
                          value={authMethod}
                          onChange={event => {
                            setAuthMethod(event.target.value === 'key' ? 'key' : 'password')
                            setPassword('')
                            setPassphrase('')
                          }}
                          disabled={busy}
                        >
                          <option value="password">Password</option>
                          <option value="key">SSH key</option>
                        </select>
                      </label>
                    </div>
                    {authMethod === 'password' ? (
                      <label className="connection-field">
                        Password
                        <input
                          type="password"
                          value={password}
                          onChange={event => setPassword(event.target.value)}
                          required
                          disabled={busy}
                          autoComplete="off"
                        />
                      </label>
                    ) : (
                      <>
                        <div className="flex items-end gap-2">
                          <label className="connection-field min-w-0 flex-1">
                            Identity file
                            <input
                              value={identityFile}
                              onChange={event => setIdentityFile(event.target.value)}
                              placeholder="Choose a private key explicitly"
                              required
                              disabled={busy}
                              autoComplete="off"
                            />
                          </label>
                          <button
                            type="button"
                            className="secondary-action"
                            disabled={busy}
                            onClick={() => {
                              void chooseFile()
                            }}
                          >
                            Browse
                          </button>
                        </div>
                        <label className="connection-field">
                          Key passphrase (optional)
                          <input
                            type="password"
                            value={passphrase}
                            onChange={event => setPassphrase(event.target.value)}
                            disabled={busy}
                            autoComplete="off"
                          />
                        </label>
                      </>
                    )}
                    <label className="connection-field">
                      Server fingerprint
                      <input
                        value={fingerprint}
                        onChange={event => setFingerprint(event.target.value)}
                        placeholder="SHA256:..."
                        required
                        disabled={busy}
                        autoComplete="off"
                      />
                    </label>
                    <p className="connection-help">
                      Ask your server administrator for its SHA256 host fingerprint and verify it
                      independently. Passwords and passphrases stay in memory for this session, up
                      to 30 minutes. Keys and SSH agents are never selected automatically.
                    </p>
                  </>
                )}
                <label className="connection-field">
                  {kind === 'url' ? 'Raw Markdown URL' : 'File path'}
                  <input
                    value={path}
                    onChange={event => setPath(event.target.value)}
                    placeholder={hint.placeholder}
                    required
                    disabled={busy}
                    autoComplete="off"
                  />
                </label>
                <p className="connection-help">{hint.help}</p>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="submit"
                    className="primary-action"
                    disabled={busy || (kind === 'wsl' && !distribution)}
                  >
                    {busy ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <ArrowRight size={15} />
                    )}
                    {actionLabel}
                  </button>
                  {canReconnect && !busy && (
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={event => {
                        if (event.currentTarget.form?.reportValidity()) {
                          void connect(getTarget(), true, true)
                        }
                      }}
                    >
                      Reconnect &amp; keep edits
                    </button>
                  )}
                  {busy && (
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => window.api.cancelConnection()}
                    >
                      Cancel request
                    </button>
                  )}
                </div>
                <div className="flex gap-2 border-t border-border pt-4">
                  <input
                    aria-label="Connection profile name"
                    value={profileName}
                    onChange={event => setProfileName(event.target.value)}
                    className="connection-input min-w-0 flex-1"
                    placeholder="Profile name (optional)"
                    disabled={busy}
                    maxLength={80}
                  />
                  <button
                    type="button"
                    className="secondary-action"
                    disabled={busy}
                    onClick={saveProfile}
                  >
                    <BookmarkPlus size={14} />
                    Save profile
                  </button>
                </div>
              </>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-border bg-surface-raised p-3 text-xs leading-relaxed text-text-primary"
              >
                {error}
              </p>
            )}
          </form>
          {profiles.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="mb-2 text-xs font-semibold text-text-secondary">Saved connections</h3>
              {profiles.map(profile => (
                <div key={profile.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="min-w-0 flex-1 truncate rounded-md px-2 py-2 text-left text-xs hover:bg-surface-raised"
                    title={targetLabel(profile.target)}
                    onClick={() => {
                      void connect(profile.target)
                    }}
                  >
                    {profile.name}
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={busy}
                    aria-label={`Remove profile ${profile.name}`}
                    onClick={() => useConnectionStore.getState().removeProfile(profile.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {recent.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <Clock size={12} />
                  Recently opened
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={useConnectionStore.getState().clearRecent}
                  className="text-accent"
                >
                  Clear
                </button>
              </div>
              {recent.slice(0, 5).map(item => (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  className="block w-full truncate rounded-md px-2 py-2 text-left text-xs text-text-secondary hover:bg-surface-raised hover:text-accent"
                  title={item.name}
                  onClick={() => {
                    void connect(item.target)
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export const ConnectionHub: FC = () => {
  const open = useUIStore(state => state.connectionsOpen)
  const busy = useUIStore(state => state.fileBusy)
  return (
    <Dialog.Root
      open={open}
      onOpenChange={value => {
        if (!busy) {
          useUIStore.getState().setConnectionsOpen(value)
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content top-[8%] max-w-3xl">
          <ConnectionForm />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
