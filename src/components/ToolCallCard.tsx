import { useState, useEffect, useCallback } from 'react'
import {
  Terminal, FileEdit, File, Search, Wrench,
  ChevronRight, CheckCircle2, XCircle, Loader2, Copy, Check,
} from 'lucide-react'
import type { ToolCall, ToolStatus } from '@/types'

// ── Icon mapping ──

const TOOL_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  terminal: Terminal,
  edit: FileEdit,
  file: File,
  search: Search,
  wrench: Wrench,
}

const TOOL_LABELS: Record<string, string> = {
  bash: 'Bash',
  execute: 'Bash',
  run: 'Bash',
  shell: 'Bash',
  write: '写入',
  edit: '编辑',
  write_file: '写入',
  edit_file: '编辑',
  read: '读取',
  read_file: '读取',
  grep: '搜索',
  glob: '搜索',
  search: '搜索',
  find: '搜索',
  list: '列表',
  ls: '列表',
}

function getToolCategory(name: string): string {
  const n = name.toLowerCase()
  if (['bash', 'execute', 'run', 'shell'].includes(n)) return 'terminal'
  if (['write', 'edit', 'write_file', 'edit_file'].includes(n)) return 'edit'
  if (['read', 'read_file'].includes(n)) return 'file'
  if (['grep', 'glob', 'search', 'find'].includes(n)) return 'search'
  return 'wrench'
}

// ── Status indicator ──

function StatusDot({ status }: { status: ToolStatus }) {
  if (status === 'running') {
    return <Loader2 size={14} className="tool-status-icon tool-status-running" />
  }
  if (status === 'success') {
    return <CheckCircle2 size={14} className="tool-status-icon tool-status-success" />
  }
  if (status === 'error') {
    return <XCircle size={14} className="tool-status-icon tool-status-error" />
  }
  return <span className="tool-status-dot tool-status-pending" />
}

// ── Duration timer ──

function DurationTimer({ startTime, endTime }: { startTime?: number; endTime?: number }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startTime || endTime) {
      if (startTime && endTime) {
        setElapsed(endTime - startTime)
      }
      return
    }
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 100)
    return () => clearInterval(iv)
  }, [startTime, endTime])

  if (!startTime) return null
  const secs = (elapsed / 1000).toFixed(1)
  return <span className="tool-duration">{secs}s</span>
}

// ── Output renderer ──

function ToolOutput({ content, toolName }: { content: string; toolName: string }) {
  const [copied, setCopied] = useState(false)
  const category = getToolCategory(toolName)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [content])

  if (!content) return null

  // Truncate very long outputs for display
  const MAX_LINES = 50
  const lines = content.split('\n')
  const isTruncated = lines.length > MAX_LINES
  const displayContent = isTruncated ? lines.slice(0, MAX_LINES).join('\n') : content

  return (
    <div className="tool-output">
      <div className="tool-output-header">
        <span className="tool-output-label">
          {category === 'terminal' ? '输出' : category === 'edit' ? '变更' : '结果'}
        </span>
        <button className="tool-output-copy" onClick={handleCopy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="tool-output-content">
        {displayContent}
        {isTruncated && (
          <span className="tool-output-truncated">
            {'\n'}... 已截断（共 {lines.length} 行）
          </span>
        )}
      </pre>
    </div>
  )
}

// ── Input summary ──

function getInputSummary(toolName: string, input?: Record<string, unknown>): string {
  if (!input) return ''
  const n = toolName.toLowerCase()

  // Bash: show command
  if (['bash', 'execute', 'run', 'shell'].includes(n)) {
    const cmd = String(input.command || input.cmd || '')
    return cmd.length > 80 ? cmd.slice(0, 80) + '...' : cmd
  }
  // Read/Write/Edit: show file path
  if (['read', 'read_file', 'write', 'write_file', 'edit', 'edit_file'].includes(n)) {
    return String(input.file_path || input.path || input.filePath || '')
  }
  // Search: show pattern
  if (['grep', 'glob', 'search', 'find'].includes(n)) {
    return String(input.pattern || input.query || input.path || '')
  }
  // Fallback: first string value
  const firstStr = Object.values(input).find((v) => typeof v === 'string')
  const s = String(firstStr || '')
  return s.length > 60 ? s.slice(0, 60) + '...' : s
}

// ── Main component ──

interface ToolCallCardProps {
  tool: ToolCall
  defaultExpanded?: boolean
}

export function ToolCallCard({ tool, defaultExpanded }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(() => {
    if (defaultExpanded !== undefined) return defaultExpanded
    return tool.status === 'running' || tool.status === 'error'
  })

  // Auto-expand when tool starts running
  useEffect(() => {
    if (tool.status === 'running') setExpanded(true)
  }, [tool.status])

  const category = getToolCategory(tool.function.name)
  const IconComponent = TOOL_ICONS[category] || Wrench
  const label = TOOL_LABELS[tool.function.name.toLowerCase()] || tool.function.name
  const summary = getInputSummary(tool.function.name, tool.input)

  // Parse input from arguments if not already parsed
  let displayInput = tool.input
  if (!displayInput && tool.function.arguments) {
    try {
      displayInput = JSON.parse(tool.function.arguments)
    } catch {}
  }

  return (
    <div className={`tool-card tool-status-${tool.status}`}>
      {/* Header row */}
      <button
        className="tool-card-header"
        onClick={() => setExpanded(!expanded)}
        disabled={tool.status === 'running'} // Don't allow collapse while running
      >
        <span className="tool-card-chevron-wrapper">
          <ChevronRight
            size={14}
            className={`tool-card-chevron ${expanded ? 'tool-card-chevron-open' : ''}`}
          />
        </span>
        <IconComponent size={14} className="tool-card-icon" />
        <span className="tool-card-label">{label}</span>
        {summary && <span className="tool-card-summary">{summary}</span>}
        <span className="tool-card-meta">
          <DurationTimer startTime={tool.startTime} endTime={tool.endTime} />
          <StatusDot status={tool.status} />
        </span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="tool-card-body">
          {/* Input section */}
          {displayInput && Object.keys(displayInput).length > 0 && (
            <div className="tool-input-section">
              <div className="tool-input-header">参数</div>
              <pre className="tool-input-content">
                {JSON.stringify(displayInput, null, 2)}
              </pre>
            </div>
          )}

          {/* Output section */}
          {tool.output && (
            <ToolOutput content={tool.output} toolName={tool.function.name} />
          )}

          {/* Streaming output indicator */}
          {tool.status === 'running' && !tool.output && (
            <div className="tool-output-loading">
              <span className="tool-output-loading-dot" />
              <span className="tool-output-loading-dot" />
              <span className="tool-output-loading-dot" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
