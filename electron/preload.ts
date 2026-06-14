import { contextBridge, ipcRenderer } from 'electron'

export interface KimiStreamData {
  role: 'assistant' | 'tool' | 'meta' | 'thinking'
  content?: string
  tool_calls?: Array<{
    type: 'function'
    id: string
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  type?: string
  session_id?: string
  command?: string
}

export interface ApprovalRequestData {
  type: 'approval_request'
  id: string
  tool_name: string
  action: string
  display: unknown
}

const api = {
  // ── kimi-code CLI ──
  kimi: {
    send: (content: string, options?: Record<string, string>) =>
      ipcRenderer.invoke('kimi:send', content, options || {}),

    cancel: () => ipcRenderer.invoke('kimi:cancel'),

    getSession: () => ipcRenderer.invoke('kimi:getSession'),

    approvalResponse: (response: Record<string, unknown>) =>
      ipcRenderer.invoke('kimi:approvalResponse', response),

    onStream: (callback: (data: KimiStreamData) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: KimiStreamData) => callback(data)
      ipcRenderer.on('kimi:stream', handler)
      return () => ipcRenderer.removeListener('kimi:stream', handler)
    },

    onApprovalRequest: (callback: (data: ApprovalRequestData) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: ApprovalRequestData) => callback(data)
      ipcRenderer.on('kimi:approvalRequest', handler)
      return () => ipcRenderer.removeListener('kimi:approvalRequest', handler)
    },

    onStderr: (callback: (line: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, line: string) => callback(line)
      ipcRenderer.on('kimi:stderr', handler)
      return () => ipcRenderer.removeListener('kimi:stderr', handler)
    },

    onDone: (callback: (info: { code: number; sessionId: string | null }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info: { code: number; sessionId: string | null }) => callback(info)
      ipcRenderer.on('kimi:done', handler)
      return () => ipcRenderer.removeListener('kimi:done', handler)
    },

    onError: (callback: (message: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, message: string) => callback(message)
      ipcRenderer.on('kimi:error', handler)
      return () => ipcRenderer.removeListener('kimi:error', handler)
    },

    onSession: (callback: (info: { id: string; command: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info: { id: string; command: string }) => callback(info)
      ipcRenderer.on('kimi:session', handler)
      return () => ipcRenderer.removeListener('kimi:session', handler)
    },
  },

  // ── Dialogs ──
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
  },

  // ── File System ──
  fs: {
    readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  },

  // ── Persistence ──
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
  },

  // ── Terminal ──
  terminal: {
    start: (cwd: string) => ipcRenderer.invoke('terminal:start', cwd),
    write: (data: string) => ipcRenderer.invoke('terminal:write', data),
    resize: (cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', cols, rows),
    kill: () => ipcRenderer.invoke('terminal:kill'),
    onData: (callback: (data: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: string) => callback(data)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
    onExit: (callback: (code: number) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, code: number) => callback(code)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    },
  },
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
