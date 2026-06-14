import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronRight, Brain, Clock } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { markdownComponents } from './MessageBubble'
import type { ThinkingBlock as ThinkingBlockType } from '@/types'

interface ThinkingBlockProps {
  block: ThinkingBlockType
}

function formatDuration(startTime?: number, endTime?: number): string {
  if (!startTime) return ''
  const end = endTime || Date.now()
  const seconds = ((end - startTime) / 1000).toFixed(1)
  return `${seconds}s`
}

export function ThinkingBlockComponent({ block }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(() => block.isStreaming === true)
  const [displayLen, setDisplayLen] = useState(block.content.length)
  const prevContentLenRef = useRef(block.content.length)
  const rafRef = useRef<number>(0)

  // Auto-expand when streaming, auto-collapse after streaming finishes
  useEffect(() => {
    if (block.isStreaming) {
      setExpanded(true)
    }
  }, [block.isStreaming])

  // Smooth character-by-character reveal animation while streaming
  useEffect(() => {
    const targetLen = block.content.length

    if (!block.isStreaming) {
      // When streaming finishes, show all content immediately
      setDisplayLen(targetLen)
      return
    }

    // If content grew, animate towards the new length
    if (targetLen > prevContentLenRef.current) {
      const animate = () => {
        setDisplayLen((prev) => {
          if (prev >= targetLen) return targetLen
          const remaining = targetLen - prev
          const step = Math.max(1, Math.ceil(remaining * 0.15))
          const next = Math.min(prev + step, targetLen)
          if (next < targetLen) {
            rafRef.current = requestAnimationFrame(animate)
          }
          return next
        })
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    prevContentLenRef.current = targetLen
    return () => cancelAnimationFrame(rafRef.current)
  }, [block.content.length, block.isStreaming])

  // Auto-collapse after streaming finishes (with a small delay for a smooth transition)
  const prevStreamingRef = useRef(block.isStreaming)
  useEffect(() => {
    if (prevStreamingRef.current && !block.isStreaming) {
      // Transitioned from streaming to done — collapse after a brief pause
      const timer = setTimeout(() => setExpanded(false), 800)
      return () => clearTimeout(timer)
    }
    prevStreamingRef.current = block.isStreaming
  }, [block.isStreaming])

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  const duration = formatDuration(block.startTime, block.endTime)
  const isStreaming = !!block.isStreaming
  const visibleContent = block.content.slice(0, displayLen)
  const hasContent = block.content.length > 0

  return (
    <div className={`thinking-block ${isStreaming ? 'thinking-block-streaming' : ''}`}>
      <button className="thinking-block-header" onClick={handleToggle}>
        <span className="thinking-block-chevron-wrapper">
          <ChevronRight
            size={14}
            className={`thinking-block-chevron ${expanded ? 'thinking-block-chevron-open' : ''}`}
          />
        </span>
        <Brain size={14} className="thinking-block-icon" />
        <span className="thinking-block-label">
          {isStreaming ? '思考中…' : '思考过程'}
        </span>
        {duration && (
          <span className="thinking-block-duration">
            <Clock size={11} />
            {duration}
          </span>
        )}
        {!isStreaming && hasContent && (
          <span className="thinking-block-preview">
            {block.content.slice(0, 50).replace(/\n/g, ' ')}
            {block.content.length > 50 ? '…' : ''}
          </span>
        )}
      </button>

      {expanded && hasContent && (
        <div className="thinking-block-body">
          <div className="thinking-block-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {visibleContent}
            </ReactMarkdown>
          </div>
          {isStreaming && <span className="thinking-block-streaming-indicator" />}
        </div>
      )}

      {expanded && !hasContent && isStreaming && (
        <div className="thinking-block-body">
          <div className="thinking-block-empty">
            <span className="thinking-block-empty-dot" />
            <span className="thinking-block-empty-dot" />
            <span className="thinking-block-empty-dot" />
          </div>
        </div>
      )}
    </div>
  )
}