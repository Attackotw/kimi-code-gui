import { ShieldCheck, Terminal, FileEdit, File, Search, Wrench, AlertTriangle } from 'lucide-react'
import { useAppStore } from '@/stores/app'
import type { ApprovalRequest, ApprovalDisplayBlock } from '@/types'

// ── Icon mapping ──

function getToolIcon(toolName: string) {
  const n = toolName.toLowerCase()
  if (['bash', 'execute', 'run', 'shell'].some((k) => n.includes(k))) return Terminal
  if (['write', 'edit', 'write_file', 'edit_file'].some((k) => n.includes(k))) return FileEdit
  if (['read', 'read_file'].some((k) => n.includes(k))) return File
  if (['grep', 'glob', 'search', 'find'].some((k) => n.includes(k))) return Search
  return Wrench
}

function getToolLabel(toolName: string): string {
  const labels: Record<string, string> = {
    Bash: '执行命令',
    Write: '写入文件',
    Edit: '编辑文件',
    Read: '读取文件',
    Grep: '搜索内容',
    Glob: '搜索文件',
    TaskStop: '停止任务',
    ExitPlanMode: '执行计划',
  }
  return labels[toolName] || `执行 ${toolName}`
}

// ── Display block renderers ──

function ShellBlock({ block }: { block: ApprovalDisplayBlock }) {
  return (
    <div className="approval-block approval-block-shell">
      {block.cwd && <div className="approval-block-meta">目录: {block.cwd}</div>}
      {block.danger && (
        <div className="approval-block-danger">
          <AlertTriangle size={14} />
          <span>危险操作: {block.danger}</span>
        </div>
      )}
      <pre className="approval-block-command">
        <span className="approval-block-prompt">$</span> {block.command}
      </pre>
      {block.description && <div className="approval-block-desc">{block.description}</div>}
    </div>
  )
}

function DiffBlock({ block }: { block: ApprovalDisplayBlock }) {
  return (
    <div className="approval-block approval-block-diff">
      <div className="approval-block-path">{block.path}</div>
      <div className="approval-diff-container">
        {block.old_text && (
          <div className="approval-diff-old">
            <pre>{block.old_text}</pre>
          </div>
        )}
        {block.new_text && (
          <div className="approval-diff-new">
            <pre>{block.new_text}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

function FileContentBlock({ block }: { block: ApprovalDisplayBlock }) {
  const lines = (block.content || '').split('\n')
  const shown = lines.slice(0, 20)
  const remaining = lines.length - shown.length

  return (
    <div className="approval-block approval-block-file">
      <div className="approval-block-path">{block.path}</div>
      <pre className="approval-block-content">
        {shown.join('\n')}
        {remaining > 0 && <span className="approval-block-more">{'\n'}... 还有 {remaining} 行</span>}
      </pre>
    </div>
  )
}

function FileOpBlock({ block }: { block: ApprovalDisplayBlock }) {
  return (
    <div className="approval-block approval-block-fileop">
      <span className="approval-block-operation">{block.operation || 'file'}</span>
      <span className="approval-block-path">{block.path}</span>
      {block.detail && <span className="approval-block-detail">{block.detail}</span>}
    </div>
  )
}

function SearchBlock({ block }: { block: ApprovalDisplayBlock }) {
  return (
    <div className="approval-block approval-block-search">
      <span className="approval-block-label">搜索:</span> {block.query}
      {block.path && <span className="approval-block-scope"> 范围: {block.path}</span>}
    </div>
  )
}

function DisplayBlock({ block }: { block: ApprovalDisplayBlock }) {
  switch (block.type) {
    case 'shell': return <ShellBlock block={block} />
    case 'diff': return <DiffBlock block={block} />
    case 'file_content': return <FileContentBlock block={block} />
    case 'file_op': return <FileOpBlock block={block} />
    case 'search': return <SearchBlock block={block} />
    default: return null
  }
}

// ── Main component ──

export function ApprovalCard() {
  const pendingApproval: ApprovalRequest | null = useAppStore((s) => s.pendingApproval)
  const respondToApproval = useAppStore((s) => s.respondToApproval)

  if (!pendingApproval) return null

  const Icon = getToolIcon(pendingApproval.tool_name)
  const label = getToolLabel(pendingApproval.tool_name)
  const blocks = (pendingApproval.display || []) as ApprovalDisplayBlock[]

  return (
    <div className="approval-card">
      <div className="approval-card-header">
        <ShieldCheck size={16} className="approval-card-shield" />
        <span className="approval-card-label">{label}</span>
        <span className="approval-card-tool">{pendingApproval.tool_name}</span>
      </div>

      {blocks.length > 0 && (
        <div className="approval-card-body">
          {blocks.map((block, i) => (
            <DisplayBlock key={i} block={block} />
          ))}
        </div>
      )}

      <div className="approval-card-actions">
        <button
          className="approval-btn approval-btn-approve"
          onClick={() => respondToApproval('approved')}
        >
          <Icon size={14} />
          允许
        </button>
        <button
          className="approval-btn approval-btn-session"
          onClick={() => respondToApproval('approved', 'session')}
        >
          本次会话允许
        </button>
        <button
          className="approval-btn approval-btn-reject"
          onClick={() => respondToApproval('rejected')}
        >
          拒绝
        </button>
      </div>
    </div>
  )
}
