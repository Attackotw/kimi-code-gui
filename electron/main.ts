import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { execFileSync, execSync, spawn, ChildProcess } from 'child_process'
import { createInterface } from 'readline'

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let activeProcess: ChildProcess | null = null
let currentSessionId: string | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Dev server or production build
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    killActiveProcess()
  })
}

function killActiveProcess() {
  if (activeProcess && !activeProcess.killed) {
    activeProcess.kill('SIGTERM')
    activeProcess = null
  }
}

// ── kimi-code CLI integration ──

function resolveKimiPath(userPath?: string): string {
  // 1. User-configured path takes priority
  if (userPath) return userPath

  // 2. Try `which kimi` in a login shell
  try {
    const shell = process.env.SHELL || '/bin/zsh'
    const result = execSync(`${shell} -l -c "which kimi"`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim()
    if (result && !result.includes('not found')) return result
  } catch {}

  // 3. Check common install locations
  const candidates = [
    path.join(process.env.HOME || '', '.npm-global/bin/kimi'),
    path.join(process.env.HOME || '', '.npm/bin/kimi'),
    '/usr/local/bin/kimi',
    '/opt/homebrew/bin/kimi',
    path.join(process.env.HOME || '', '.local/bin/kimi'),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p
    } catch {}
  }

  // 4. Fallback — let spawn try with enriched PATH below
  return 'kimi'
}

function buildSpawnEnv(): NodeJS.ProcessEnv {
  // macOS GUI apps don't inherit shell PATH — inject common dirs
  const extra = [
    path.join(process.env.HOME || '', '.npm-global/bin'),
    path.join(process.env.HOME || '', '.npm/bin'),
    path.join(process.env.HOME || '', '.local/bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
  ]
  const existing = process.env.PATH || ''
  return {
    ...process.env,
    PATH: [...extra, existing].join(':'),
    KIMI_NON_INTERACTIVE: '1',
  }
}

// Capability cache keyed by resolved kimi binary path
const kimiCapabilityCache = new Map<string, { guiApproval: boolean }>()

function checkKimiCapabilities(kimiPath: string): { guiApproval: boolean } {
  const cached = kimiCapabilityCache.get(kimiPath)
  if (cached) return cached

  try {
    const help = execFileSync(kimiPath, ['--help'], {
      encoding: 'utf-8',
      timeout: 5000,
      env: buildSpawnEnv(),
    })
    const capabilities = { guiApproval: help.includes('--gui-approval') }
    kimiCapabilityCache.set(kimiPath, capabilities)
    return capabilities
  } catch {
    const capabilities = { guiApproval: false }
    kimiCapabilityCache.set(kimiPath, capabilities)
    return capabilities
  }
}

function sendMessage(content: string, options: {
  model?: string
  sessionId?: string
  workDir?: string
  permissionMode?: string
  kimiPath?: string
}) {
  killActiveProcess()

  const args = ['-p', content, '--output-format', 'stream-json']

  if (options.model) {
    args.push('-m', options.model)
  }
  if (options.sessionId) {
    args.push('-S', options.sessionId)
  }

  const workDir = options.workDir || process.cwd()

  // Permission mode
  if (options.permissionMode === 'auto') {
    args.push('--auto')
  } else if (options.permissionMode === 'yolo') {
    args.push('-y')
  }

  const kimiPath = resolveKimiPath(options.kimiPath)
  const capabilities = checkKimiCapabilities(kimiPath)
  if (capabilities.guiApproval) {
    args.push('--gui-approval')
  } else {
    console.warn('[kimi] installed CLI does not support --gui-approval; approval requests will not be shown')
  }

  const spawnTime = Date.now()
  console.log('[kimi] spawning:', kimiPath, 'args:', args, 'cwd:', workDir)

  const child = spawn(kimiPath, args, {
    cwd: workDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: buildSpawnEnv(),
  })

  activeProcess = child

  // Stream stdout line by line (NDJSON)
  const rl = createInterface({ input: child.stdout! })
  let lineCount = 0
  rl.on('line', (line) => {
    if (!line.trim()) return
    lineCount++
    try {
      const data = JSON.parse(line)
      const elapsed = Date.now() - spawnTime
      if (lineCount <= 3) {
        console.log(`[kimi] line #${lineCount} at +${elapsed}ms:`, JSON.stringify(data).slice(0, 120))
      }

      // Intercept approval requests — forward to renderer via dedicated channel
      if (data.type === 'approval_request') {
        mainWindow?.webContents.send('kimi:approvalRequest', data)
        return
      }

      mainWindow?.webContents.send('kimi:stream', data)

      // Capture session ID from resume hint
      if (data.role === 'meta' && data.type === 'session.resume_hint') {
        currentSessionId = data.session_id
        mainWindow?.webContents.send('kimi:session', {
          id: data.session_id,
          command: data.command,
        })
      }
    } catch {
      // Non-JSON output (might be plain text fallback)
      mainWindow?.webContents.send('kimi:stream', {
        role: 'assistant',
        content: line,
      })
    }
  })

  // Stream stderr
  const errRl = createInterface({ input: child.stderr! })
  errRl.on('line', (line) => {
    console.error('[kimi] stderr:', line)
    mainWindow?.webContents.send('kimi:stderr', line)
  })

  child.on('close', (code) => {
    const elapsed = Date.now() - spawnTime
    console.log(`[kimi] process closed at +${elapsed}ms, code=${code}, lines=${lineCount}`)
    mainWindow?.webContents.send('kimi:done', { code, sessionId: currentSessionId })
    activeProcess = null
  })

  child.on('error', (err) => {
    mainWindow?.webContents.send('kimi:error', err.message)
    activeProcess = null
  })
}

// ── IPC Handlers ──

ipcMain.handle('kimi:send', (_event, content: string, options: Record<string, string>) => {
  sendMessage(content, options)
  return { status: 'started' }
})

ipcMain.handle('kimi:cancel', () => {
  killActiveProcess()
  return { status: 'cancelled' }
})

ipcMain.handle('kimi:approvalResponse', (_event, response: Record<string, unknown>) => {
  if (activeProcess?.stdin) {
    activeProcess.stdin.write(JSON.stringify(response) + '\n')
    return { ok: true }
  }
  return { ok: false, error: 'No active process' }
})

ipcMain.handle('kimi:getSession', () => {
  return { sessionId: currentSessionId }
})

ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
  })
  return result.canceled ? null : result.filePaths
})

// File system operations (for file explorer)
ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
  const fs = await import('fs/promises')
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  return entries.map((e) => ({
    name: e.name,
    isDirectory: e.isDirectory(),
    path: path.join(dirPath, e.name),
  }))
})

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  const fs = await import('fs/promises')
  return fs.readFile(filePath, 'utf-8')
})

// ── Persistence ──

const storePath = path.join(app.getPath('userData'), 'kimi-gui-data.json')

function readStore(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(storePath, 'utf-8'))
  } catch {
    return {}
  }
}

function writeStore(data: Record<string, unknown>) {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8')
}

ipcMain.handle('store:get', (_event, key: string) => {
  const data = readStore()
  return data[key] ?? null
})

ipcMain.handle('store:set', (_event, key: string, value: unknown) => {
  const data = readStore()
  data[key] = value
  writeStore(data)
  return { ok: true }
})

// ── Terminal (node-pty) ──

let ptyProcess: any = null

ipcMain.handle('terminal:start', (_event, cwd: string) => {
  try {
    // Dynamic import for node-pty (optional dependency)
    const pty = require('node-pty')
    const shell = process.env.SHELL || '/bin/zsh'
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd || process.env.HOME || '/',
      env: { ...process.env, TERM: 'xterm-256color' },
    })
    ptyProcess.onData((data: string) => {
      mainWindow?.webContents.send('terminal:data', data)
    })
    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      mainWindow?.webContents.send('terminal:exit', exitCode)
      ptyProcess = null
    })
    return { ok: true }
  } catch {
    return { ok: false, error: 'node-pty not installed. Run: npm install node-pty' }
  }
})

ipcMain.handle('terminal:write', (_event, data: string) => {
  ptyProcess?.write(data)
})

ipcMain.handle('terminal:resize', (_event, cols: number, rows: number) => {
  ptyProcess?.resize(cols, rows)
})

ipcMain.handle('terminal:kill', () => {
  if (ptyProcess) {
    ptyProcess.kill()
    ptyProcess = null
  }
})

// ── App Lifecycle ──

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  killActiveProcess()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
