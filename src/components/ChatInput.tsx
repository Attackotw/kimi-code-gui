import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Paperclip, Square } from 'lucide-react'

interface ChatInputProps {
  onSend: (content: string) => void
  onCancel: () => void
  isStreaming: boolean
}

export function ChatInput({ onSend, onCancel, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [value])

  const handleSend = useCallback(() => {
    if (!value.trim() || isStreaming) return
    onSend(value.trim())
    setValue('')
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, isStreaming, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 中文输入法组合期间不触发发送
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    // Handle file paste if needed
    const files = e.clipboardData.files
    if (files.length > 0) {
      e.preventDefault()
      const fileList = Array.from(files).map((f) => f.name).join(', ')
      onSend(`请分析以下文件: ${fileList}`)
    }
  }

  return (
    <div className="chat-input-area">
      <div className="chat-input-wrapper">
        <div className="chat-input-box">
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="输入消息… (Enter 发送, Shift+Enter 换行)"
            rows={1}
            disabled={isStreaming}
          />
          <div className="chat-input-actions">
            <button
              className="icon-btn"
              title="附加文件"
              onClick={() => window.api?.dialog?.openFile()}
            >
              <Paperclip size={18} />
            </button>
            {isStreaming ? (
              <button
                className="send-btn"
                onClick={onCancel}
                title="停止生成"
                style={{ background: 'var(--status-danger)' }}
              >
                <Square size={16} />
              </button>
            ) : (
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={!value.trim()}
                title="发送"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
