import { create } from 'zustand'
import type { Message, Session, AppSettings, ToolCall, ToolStatus, ThinkingBlock, ApprovalRequest } from '@/types'

// ── Helpers ──

let messageCounter = 0
const nextId = () => `msg-${Date.now()}-${++messageCounter}`

const DEFAULT_SETTINGS: AppSettings = {
  model: 'default',
  kimiPath: 'kimi',
  workDir: '',
  permissionMode: 'default',
  theme: 'system',
  fontSize: 14,
}

// ── Persistence ──

const PERSIST_KEYS = ['sessions', 'settings'] as const

let saveTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSave(get: () => AppState) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const state = get()
    for (const key of PERSIST_KEYS) {
      window.api?.store?.set(key, state[key])
    }
  }, 500)
}

export async function loadPersistedState(): Promise<Partial<AppState>> {
  if (!window.api?.store) return {}
  const [sessions, settings] = await Promise.all([
    window.api.store.get('sessions'),
    window.api.store.get('settings'),
  ])
  const result: Record<string, unknown> = {}
  if (Array.isArray(sessions) && sessions.length > 0) result.sessions = sessions
  if (settings && typeof settings === 'object') result.settings = { ...DEFAULT_SETTINGS, ...settings }
  return result as Partial<AppState>
}

// ── Tool name -> icon category mapping ──

const TOOL_ICON_MAP: Record<string, string> = {
  bash: 'terminal',
  execute: 'terminal',
  run: 'terminal',
  shell: 'terminal',
  write: 'edit',
  edit: 'edit',
  write_file: 'edit',
  edit_file: 'edit',
  read: 'file',
  read_file: 'file',
  grep: 'search',
  glob: 'search',
  search: 'search',
  find: 'search',
  list: 'file',
  ls: 'file',
}

export function getToolIcon(name: string): string {
  return TOOL_ICON_MAP[name.toLowerCase()] || 'wrench'
}

// ── Store ──

interface AppState {
  // Sessions
  sessions: Session[]
  activeSessionId: string | null
  createSession: (workDir?: string) => string
  setActiveSession: (id: string) => void
  deleteSession: (id: string) => void
  updateSessionTitle: (id: string, title: string) => void
  setKimiSessionId: (id: string, kimiSessionId: string) => void

  // Messages
  addMessage: (sessionId: string, role: Message['role'], content: string, toolCalls?: ToolCall[]) => void
  appendToMessage: (sessionId: string, content: string) => void
  finalizeStreaming: (sessionId: string) => void

  // Thinking block management
  addThinkingBlock: (sessionId: string, parentMsgId: string, block: ThinkingBlock) => void
  appendToThinkingBlock: (sessionId: string, blockId: string, content: string) => void
  finalizeThinkingBlock: (sessionId: string, blockId: string) => void

  // Tool call management
  addToolCall: (sessionId: string, parentMsgId: string, tool: ToolCall) => void
  updateToolStatus: (sessionId: string, toolCallId: string, status: ToolStatus, output?: string) => void
  appendToolOutput: (sessionId: string, toolCallId: string, chunk: string) => void

  // Streaming state
  isStreaming: boolean
  setStreaming: (v: boolean) => void

  // Active process
  isCancelled: boolean
  setCancelled: (v: boolean) => void

  // Settings
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void

  // File explorer
  rootDir: string | null
  setRootDir: (dir: string | null) => void

  // Sidebar
  sidebarOpen: boolean
  toggleSidebar: () => void
  rightPanel: 'files' | 'terminal' | null
  setRightPanel: (p: 'files' | 'terminal' | null) => void

  // Approval
  pendingApproval: ApprovalRequest | null
  setPendingApproval: (req: ApprovalRequest | null) => void
  respondToApproval: (decision: string, scope?: string, feedback?: string) => void

  // Runtime stderr log (tool progress, diagnostics)
  stderrLog: string[]
  appendStderrLog: (line: string) => void
  clearStderrLog: () => void

  // Hydration
  _hydrated: boolean
  setHydrated: (v: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // ── Sessions ──
  sessions: [],
  activeSessionId: null,

  createSession: (workDir?: string) => {
    const id = `session-${Date.now()}`
    const session: Session = {
      id,
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workDir,
    }
    set((s) => ({
      sessions: [session, ...s.sessions],
      activeSessionId: id,
    }))
    debouncedSave(get)
    return id
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id })
  },

  deleteSession: (id) => {
    set((s) => {
      const sessions = s.sessions.filter((x) => x.id !== id)
      const activeSessionId =
        s.activeSessionId === id
          ? sessions[0]?.id ?? null
          : s.activeSessionId
      return { sessions, activeSessionId }
    })
    debouncedSave(get)
  },

  updateSessionTitle: (id, title) => {
    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === id ? { ...x, title, updatedAt: Date.now() } : x
      ),
    }))
    debouncedSave(get)
  },

  setKimiSessionId: (id, kimiSessionId) => {
    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === id ? { ...x, kimiSessionId, updatedAt: Date.now() } : x
      ),
    }))
    debouncedSave(get)
  },

  // ── Messages ──
  addMessage: (sessionId, role, content, toolCalls) => {
    const msg: Message = {
      id: nextId(),
      role,
      content,
      toolCalls,
      timestamp: Date.now(),
      isStreaming: role === 'assistant',
    }
    set((s) => ({
      sessions: s.sessions.map((x) =>
        x.id === sessionId
          ? { ...x, messages: [...x.messages, msg], updatedAt: Date.now() }
          : x
      ),
    }))
    debouncedSave(get)
  },

  appendToMessage: (sessionId, content) =>
    set((s) => ({
      sessions: s.sessions.map((x) => {
        if (x.id !== sessionId) return x
        const msgs = [...x.messages]
        const last = msgs[msgs.length - 1]
        if (last && last.role === 'assistant' && last.isStreaming) {
          // Append to streamBuffer (full accumulated text)
          const newBuffer = (last.streamBuffer || last.content) + content
          msgs[msgs.length - 1] = {
            ...last,
            content: newBuffer,
            streamBuffer: newBuffer,
          }
        }
        return { ...x, messages: msgs }
      }),
    })),

  finalizeStreaming: (sessionId) => {
    set((s) => ({
      sessions: s.sessions.map((x) => {
        if (x.id !== sessionId) return x
        const msgs = x.messages.map((m) => {
          if (!m.isStreaming) return m
          return {
            ...m,
            isStreaming: false,
            streamBuffer: undefined,
            thinkingBlocks: m.thinkingBlocks?.map((b) =>
              b.isStreaming ? { ...b, isStreaming: false, endTime: b.endTime || Date.now() } : b
            ),
          }
        })
        return { ...x, messages: msgs }
      }),
    }))
    debouncedSave(get)
  },

  // ── Thinking block management ──

  addThinkingBlock: (sessionId, parentMsgId, block) => {
    set((s) => ({
      sessions: s.sessions.map((x) => {
        if (x.id !== sessionId) return x
        const msgs = x.messages.map((m) => {
          if (m.id !== parentMsgId) return m
          return { ...m, thinkingBlocks: [...(m.thinkingBlocks || []), block] }
        })
        return { ...x, messages: msgs }
      }),
    }))
  },

  appendToThinkingBlock: (sessionId, blockId, content) => {
    set((s) => ({
      sessions: s.sessions.map((x) => {
        if (x.id !== sessionId) return x
        const msgs = x.messages.map((m) => {
          if (!m.thinkingBlocks?.some((b) => b.id === blockId)) return m
          return {
            ...m,
            thinkingBlocks: m.thinkingBlocks.map((b) =>
              b.id === blockId
                ? { ...b, content: b.content + content }
                : b
            ),
          }
        })
        return { ...x, messages: msgs }
      }),
    }))
  },

  finalizeThinkingBlock: (sessionId, blockId) => {
    set((s) => ({
      sessions: s.sessions.map((x) => {
        if (x.id !== sessionId) return x
        const msgs = x.messages.map((m) => {
          if (!m.thinkingBlocks?.some((b) => b.id === blockId)) return m
          return {
            ...m,
            thinkingBlocks: m.thinkingBlocks.map((b) =>
              b.id === blockId
                ? { ...b, isStreaming: false, endTime: Date.now() }
                : b
            ),
          }
        })
        return { ...x, messages: msgs }
      }),
    }))
  },

  // ── Tool call management ──
  addToolCall: (sessionId, parentMsgId, tool) => {
    set((s) => ({
      sessions: s.sessions.map((x) => {
        if (x.id !== sessionId) return x
        const msgs = x.messages.map((m) => {
          if (m.id !== parentMsgId) return m
          return { ...m, toolCalls: [...(m.toolCalls || []), tool] }
        })
        return { ...x, messages: msgs }
      }),
    }))
  },

  updateToolStatus: (sessionId, toolCallId, status, output) => {
    set((s) => ({
      sessions: s.sessions.map((x) => {
        if (x.id !== sessionId) return x
        const msgs = x.messages.map((m) => {
          if (!m.toolCalls?.some((tc) => tc.id === toolCallId)) return m
          return {
            ...m,
            toolCalls: m.toolCalls.map((tc) =>
              tc.id === toolCallId
                ? {
                    ...tc,
                    status,
                    ...(output !== undefined ? { output } : {}),
                    ...(status === 'running' ? { startTime: tc.startTime || Date.now() } : {}),
                    ...(status === 'success' || status === 'error' ? { endTime: Date.now() } : {}),
                  }
                : tc
            ),
          }
        })
        return { ...x, messages: msgs }
      }),
    }))
  },

  appendToolOutput: (sessionId, toolCallId, chunk) => {
    set((s) => ({
      sessions: s.sessions.map((x) => {
        if (x.id !== sessionId) return x
        const msgs = x.messages.map((m) => {
          if (!m.toolCalls?.some((tc) => tc.id === toolCallId)) return m
          return {
            ...m,
            toolCalls: m.toolCalls.map((tc) =>
              tc.id === toolCallId
                ? { ...tc, output: (tc.output || '') + chunk, isStreamingOutput: true }
                : tc
            ),
          }
        })
        return { ...x, messages: msgs }
      }),
    }))
  },

  // ── Streaming ──
  isStreaming: false,
  setStreaming: (v) => set({ isStreaming: v }),
  isCancelled: false,
  setCancelled: (v) => set({ isCancelled: v }),

  // ── Settings ──
  settings: DEFAULT_SETTINGS,
  updateSettings: (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }))
    debouncedSave(get)
  },

  // ── File explorer ──
  rootDir: null,
  setRootDir: (dir) => set({ rootDir: dir }),

  // ── Sidebar ──
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  rightPanel: null,
  setRightPanel: (p) => set((s) => ({ rightPanel: s.rightPanel === p ? null : p })),

  // ── Hydration ──
  _hydrated: false,
  setHydrated: (v) => set({ _hydrated: v }),

  // ── Approval ──
  pendingApproval: null,
  setPendingApproval: (req) => set({ pendingApproval: req }),
  respondToApproval: (decision, scope, feedback) => {
    const response: Record<string, unknown> = {
      type: 'approval_response',
      decision,
      scope,
      feedback,
    }
    window.api?.kimi?.approvalResponse(response)
    set({ pendingApproval: null })
  },

  // ── Runtime stderr log ──
  stderrLog: [],
  appendStderrLog: (line) =>
    set((s) => {
      const next = [...s.stderrLog, line]
      if (next.length > 1000) next.shift()
      return { stderrLog: next }
    }),
  clearStderrLog: () => set({ stderrLog: [] }),
}))
