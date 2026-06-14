import { useRef, useEffect, useState } from 'react'
import { FolderOpen, Terminal as TerminalIcon, Sidebar as SidebarIcon } from 'lucide-react'
import { useAppStore } from '@/stores/app'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { ApprovalCard } from './ApprovalCard'
import { useKimiCli } from '@/hooks/useKimiCli'

export function ChatPanel() {
  const sessions = useAppStore((s) => s.sessions)
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const rightPanel = useAppStore((s) => s.rightPanel)
  const setRightPanel = useAppStore((s) => s.setRightPanel)
  const { sendMessage, cancelMessage, isStreaming } = useKimiCli()
  const [isDragging, setIsDragging] = useState(false)

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const messages = activeSession?.messages ?? []
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Drag-drop file upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    // Read file contents via Electron IPC
    const filePaths = files.map((f) => (f as any).path).filter(Boolean)

    if (filePaths.length > 0 && window.api?.fs) {
      const parts: string[] = []
      for (const fp of filePaths) {
        try {
          const content = await window.api.fs.readFile(fp)
          const name = fp.split('/').pop() || fp
          // Truncate large files
          const truncated = content.length > 8000
            ? content.slice(0, 8000) + `\n... (截断，共 ${content.length} 字符)`
            : content
          parts.push(`\`\`\`file: ${name}\n${truncated}\n\`\`\``)
        } catch {
          parts.push(`(无法读取: ${fp})`)
        }
      }
      sendMessage(`请分析以下文件:\n\n${parts.join('\n\n')}`)
    } else {
      // Fallback: just send filenames
      const fileList = files.map((f) => f.name).join(', ')
      sendMessage(`请分析以下文件: ${fileList}`)
    }
  }

  return (
    <main
      className="chat-panel"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="chat-header">
        {!sidebarOpen && (
          <button className="icon-btn" onClick={toggleSidebar} title="打开侧边栏">
            <SidebarIcon size={18} />
          </button>
        )}
        <span className="chat-header-title">
          {activeSession?.title || 'Kimi Code'}
        </span>
        <div className="chat-header-actions">
          <button
            className={`icon-btn ${rightPanel === 'files' ? 'active' : ''}`}
            onClick={() => setRightPanel('files')}
            title="文件浏览器"
          >
            <FolderOpen size={18} />
          </button>
          <button
            className={`icon-btn ${rightPanel === 'terminal' ? 'active' : ''}`}
            onClick={() => setRightPanel('terminal')}
            title="终端"
          >
            <TerminalIcon size={18} />
          </button>
          {sidebarOpen && (
            <button className="icon-btn" onClick={toggleSidebar} title="关闭侧边栏">
              <SidebarIcon size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Messages or empty state */}
      {messages.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-state-icon" viewBox="0 0 64 64" fill="none">
            <rect x="8" y="12" width="48" height="40" rx="6" stroke="currentColor" strokeWidth="2" />
            <path d="M8 24h48" stroke="currentColor" strokeWidth="2" />
            <circle cx="16" cy="18" r="2" fill="currentColor" />
            <circle cx="24" cy="18" r="2" fill="currentColor" />
            <circle cx="32" cy="18" r="2" fill="currentColor" />
            <path d="M20 34h24M20 40h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <h3>开始新对话</h3>
          <p>输入问题或拖拽文件到此处，Kimi Code 将帮你分析和解决问题。</p>
        </div>
      ) : (
        <div className="messages-area">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Approval card */}
      <ApprovalCard />

      {/* Input */}
      <ChatInput onSend={sendMessage} onCancel={cancelMessage} isStreaming={isStreaming} />

      {/* Drag overlay */}
      {isDragging && (
        <div className="drop-overlay">
          <span className="drop-overlay-text">释放文件以上传</span>
        </div>
      )}
    </main>
  )
}
