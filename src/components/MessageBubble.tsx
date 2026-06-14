import { User, Bot, Wrench, Copy, Check } from 'lucide-react'
import { useState, useCallback, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ToolCallCard } from './ToolCallCard'
import { ThinkingBlockComponent } from './ThinkingBlock'
import type { Message } from '@/types'

interface MessageBubbleProps {
  message: Message
}

const roleLabels: Record<string, string> = {
  user: '你',
  assistant: 'Kimi',
  system: '系统',
}

const roleAvatarClass: Record<string, string> = {
  user: 'user',
  assistant: 'assistant',
  system: 'system',
}

const roleAvatarIcon: Record<string, React.ReactNode> = {
  user: <User size={16} />,
  assistant: <Bot size={16} />,
  system: <Wrench size={14} />,
}

// ── Code block with copy ──

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [children])

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-block-lang">{language || 'code'}</span>
        <button className="code-block-copy" onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: '0 0 8px 8px',
          fontSize: 13,
          lineHeight: 1.5,
        }}
        showLineNumbers={children.split('\n').length > 3}
        wrapLongLines
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}

// ── Streaming text with smooth rendering ──

function StreamingContent({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  const [displayLen, setDisplayLen] = useState(isStreaming ? 0 : content.length)
  const rafRef = useRef<number>(0)
  const targetLen = content.length

  useEffect(() => {
    if (!isStreaming) {
      setDisplayLen(content.length)
      return
    }
    // Smooth character-by-character reveal
    const animate = () => {
      setDisplayLen((prev) => {
        if (prev >= targetLen) return targetLen
        // Reveal speed: ~60 chars/sec, min 2 chars per frame
        const remaining = targetLen - prev
        const step = Math.max(2, Math.ceil(remaining * 0.08))
        const next = Math.min(prev + step, targetLen)
        if (next < targetLen) {
          rafRef.current = requestAnimationFrame(animate)
        }
        return next
      })
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [targetLen, isStreaming])

  const visibleContent = content.slice(0, displayLen)

  return (
    <>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {visibleContent}
      </ReactMarkdown>
      {isStreaming && displayLen < targetLen && <span className="streaming-cursor" />}
      {isStreaming && displayLen >= targetLen && <span className="streaming-waiting" />}
    </>
  )
}

// ── Markdown components ──

export const markdownComponents = {
  code({ className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '')
    const codeStr = String(children).replace(/\n$/, '')
    if (!match && !codeStr.includes('\n')) {
      return <code className="inline-code" {...props}>{children}</code>
    }
    return <CodeBlock language={match?.[1] || ''} children={codeStr} />
  },
  p({ children }: any) {
    return <p style={{ margin: '0.4em 0' }}>{children}</p>
  },
  ul({ children }: any) {
    return <ul style={{ paddingLeft: '1.5em', margin: '0.4em 0' }}>{children}</ul>
  },
  ol({ children }: any) {
    return <ol style={{ paddingLeft: '1.5em', margin: '0.4em 0' }}>{children}</ol>
  },
  a({ href, children }: any) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  },
  table({ children }: any) {
    return (
      <div style={{ overflowX: 'auto', margin: '0.5em 0' }}>
        <table className="markdown-table">{children}</table>
      </div>
    )
  },
  h1({ children }: any) { return <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0.8em 0 0.4em' }}>{children}</h3> },
  h2({ children }: any) { return <h4 style={{ fontSize: 16, fontWeight: 600, margin: '0.8em 0 0.4em' }}>{children}</h4> },
  h3({ children }: any) { return <h5 style={{ fontSize: 15, fontWeight: 600, margin: '0.6em 0 0.3em' }}>{children}</h5> },
  blockquote({ children }: any) {
    return (
      <blockquote style={{
        borderLeft: '3px solid var(--border)',
        paddingLeft: 12,
        margin: '0.5em 0',
        color: 'var(--muted-foreground)',
      }}>
        {children}
      </blockquote>
    )
  },
}

// ── Main component ──

export function MessageBubble({ message }: MessageBubbleProps) {
  const hasTools = message.toolCalls && message.toolCalls.length > 0
  const hasContent = message.content && message.content.trim().length > 0
  const isStreaming = !!message.isStreaming

  // Tool results should NEVER render as standalone messages.
  // Their content is always folded into the parent ToolCallCard.
  if (message.role === 'tool') return null

  // System messages (errors, etc.)
  if (message.role === 'system') {
    return (
      <div className="message system-message">
        <div className="system-message-content">
          <Wrench size={14} />
          <span>{message.content}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="message">
      <div className="message-inner">
        <div className={`message-avatar ${roleAvatarClass[message.role] || 'system'}`}>
          {roleAvatarIcon[message.role] || <Wrench size={14} />}
        </div>
        <div className="message-body">
          <div className="message-role">{roleLabels[message.role] || message.role}</div>

          {/* Thinking blocks */}
          {message.thinkingBlocks && message.thinkingBlocks.length > 0 && (
            <div className="thinking-blocks-container">
              {message.thinkingBlocks.map((block) => (
                <ThinkingBlockComponent key={block.id} block={block} />
              ))}
            </div>
          )}

          {/* Tool calls */}
          {hasTools && (
            <div className="tool-calls-container">
              {message.toolCalls!.map((tc) => (
                <ToolCallCard
                  key={tc.id}
                  tool={tc}
                />
              ))}
            </div>
          )}

          {/* Text content */}
          {hasContent && (
            <div className="message-content">
              {isStreaming ? (
                <StreamingContent content={message.content} isStreaming={true} />
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {message.content}
                </ReactMarkdown>
              )}
            </div>
          )}

          {/* Empty streaming message (waiting for first content) */}
          {isStreaming && !hasContent && !hasTools && !(message.thinkingBlocks && message.thinkingBlocks.length > 0) && (
            <div className="message-content">
              <span className="streaming-thinking">
                <span className="streaming-thinking-dot" />
                <span className="streaming-thinking-dot" />
                <span className="streaming-thinking-dot" />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
