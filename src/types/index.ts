// ── Message types ──

export type ToolStatus = 'pending' | 'running' | 'success' | 'error'

export interface ToolCall {
  type: 'function'
  id: string
  function: {
    name: string
    arguments: string
  }
  // Enhanced fields for UI
  status: ToolStatus
  input?: Record<string, unknown>
  output?: string
  startTime?: number
  endTime?: number
  isStreamingOutput?: boolean
}

export interface ThinkingBlock {
  id: string
  content: string
  startTime?: number
  endTime?: number
  isStreaming?: boolean
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  thinkingBlocks?: ThinkingBlock[]
  toolCalls?: ToolCall[]
  timestamp: number
  isStreaming?: boolean
  // For smooth streaming: buffer of full text, displayContent rendered progressively
  streamBuffer?: string
}

// ── Session ──

export interface Session {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  workDir?: string
  kimiSessionId?: string
}

// ── File Explorer ──

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

// ── Settings ──

export interface AppSettings {
  model: string
  kimiPath: string
  workDir: string
  permissionMode: 'default' | 'auto' | 'yolo'
  theme: 'light' | 'dark' | 'system'
  fontSize: number
}

// ── kimi-code stream data ──

export interface KimiStreamData {
  role: 'assistant' | 'tool' | 'meta' | 'thinking'
  content?: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  type?: string
  session_id?: string
  command?: string
}

// ── Approval ──

export interface ApprovalDisplayBlock {
  type: string
  command?: string
  path?: string
  content?: string
  old_text?: string
  new_text?: string
  query?: string
  url?: string
  description?: string
  cwd?: string
  danger?: string
  language?: string
  operation?: string
  detail?: string
}

export interface ApprovalRequest {
  type: 'approval_request'
  id: string
  tool_name: string
  action: string
  display: ApprovalDisplayBlock[]
}

export type ApprovalDecision = 'approved' | 'approved_for_session' | 'rejected'

// ── Electron API (from preload) ──

export interface ElectronAPI {
  kimi: {
    send: (content: string, options?: Record<string, string>) => Promise<{ status: string }>
    cancel: () => Promise<{ status: string }>
    getSession: () => Promise<{ sessionId: string | null }>
    onStream: (callback: (data: KimiStreamData) => void) => () => void
    onStderr: (callback: (line: string) => void) => () => void
    onDone: (callback: (info: { code: number; sessionId: string | null }) => void) => () => void
    onError: (callback: (message: string) => void) => () => void
    onSession: (callback: (info: { id: string; command: string }) => void) => () => void
    onApprovalRequest: (callback: (data: any) => void) => () => void
    approvalResponse: (response: Record<string, unknown>) => Promise<{ ok: boolean }>
  }
  dialog: {
    openDirectory: () => Promise<string | null>
    openFile: () => Promise<string[] | null>
  }
  fs: {
    readDir: (dirPath: string) => Promise<FileEntry[]>
    readFile: (filePath: string) => Promise<string>
  }
  store: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<{ ok: boolean }>
  }
  terminal: {
    start: (cwd: string) => Promise<{ ok: boolean; error?: string }>
    write: (data: string) => Promise<void>
    resize: (cols: number, rows: number) => Promise<void>
    kill: () => Promise<void>
    onData: (callback: (data: string) => void) => () => void
    onExit: (callback: (code: number) => void) => () => void
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
