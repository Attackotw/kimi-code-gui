import { useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/app'
import type { KimiStreamData, ToolCall, ThinkingBlock, ApprovalRequest } from '@/types'

export function useKimiCli() {
  const {
    activeSessionId,
    settings,
    addMessage,
    appendToMessage,
    finalizeStreaming,
    setStreaming,
    isStreaming,
    setCancelled,
    updateSessionTitle,
    setKimiSessionId,
    addToolCall,
    updateToolStatus,
    addThinkingBlock,
    appendToThinkingBlock,
    finalizeThinkingBlock,
    setPendingApproval,
    appendStderrLog,
    clearStderrLog,
  } = useAppStore()

  // Subscribe to kimi-code stream events
  useEffect(() => {
    if (!window.api?.kimi) return

    const unsubStream = window.api.kimi.onStream((data: KimiStreamData) => {
      if (!activeSessionId) return

      // ── Assistant message: may carry BOTH text and tool_calls ──
      // stream-json flushes assistant text and tool_calls together, so we must
      // handle content and tool_calls in the same branch. Using `else if` here
      // silently drops tool_calls whenever the message also contains content.
      if (data.role === 'assistant') {
        const hasContent = data.content && data.content.length > 0
        const hasToolCalls = data.tool_calls && data.tool_calls.length > 0
        if (!hasContent && !hasToolCalls) return

        const session = useAppStore.getState().sessions.find((s) => s.id === activeSessionId)
        const lastMsg = session?.messages[session.messages.length - 1]

        if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
          // Finalize any streaming thinking block before appending text
          if (hasContent) {
            const streamingBlock = lastMsg.thinkingBlocks?.find((b) => b.isStreaming)
            if (streamingBlock) {
              finalizeThinkingBlock(activeSessionId, streamingBlock.id)
            }
            appendToMessage(activeSessionId, data.content!)
          }

          // Attach tool calls to the same streaming assistant message
          if (hasToolCalls) {
            for (const tc of data.tool_calls!) {
              const exists = lastMsg.toolCalls?.some((t) => t.id === tc.id)
              if (exists) continue

              let input: Record<string, unknown> | undefined
              try {
                input = typeof tc.function.arguments === 'string'
                  ? JSON.parse(tc.function.arguments)
                  : tc.function.arguments
              } catch {}

              const toolCall: ToolCall = {
                ...tc,
                status: 'running',
                input,
                startTime: Date.now(),
              }
              addToolCall(activeSessionId, lastMsg.id, toolCall)
            }
          }
        } else {
          // Start a new assistant message; collect any tool calls first
          const newToolCalls: ToolCall[] = []
          if (hasToolCalls) {
            for (const tc of data.tool_calls!) {
              let input: Record<string, unknown> | undefined
              try {
                input = typeof tc.function.arguments === 'string'
                  ? JSON.parse(tc.function.arguments)
                  : tc.function.arguments
              } catch {}
              newToolCalls.push({
                ...tc,
                status: 'running',
                input,
                startTime: Date.now(),
              })
            }
          }
          addMessage(activeSessionId, 'assistant', data.content || '', newToolCalls.length > 0 ? newToolCalls : undefined)
        }
      }

      // ── Tool result: tool finished execution ──
      // CRITICAL: tool results must ALWAYS be attached to a ToolCall,
      // NEVER added as a separate message bubble.
      else if (data.role === 'tool') {
        const session = useAppStore.getState().sessions.find((s) => s.id === activeSessionId)
        if (!session) return

        // Exact match by tool_call_id across the whole session
        let targetToolId: string | null = null
        if (data.tool_call_id) {
          for (const m of session.messages) {
            const tc = m.toolCalls?.find((t) => t.id === data.tool_call_id)
            if (tc) {
              targetToolId = tc.id
              break
            }
          }
        }

        if (targetToolId) {
          const isError = data.content?.toLowerCase().includes('error') ||
                          data.content?.toLowerCase().includes('failed')
          updateToolStatus(
            activeSessionId,
            targetToolId,
            isError ? 'error' : 'success',
            data.content || ''
          )
          return
        }

        // Orphan tool result: something went wrong upstream. Create a fallback
        // tool call on the most recent assistant message so the user still sees
        // what happened, but mark it clearly.
        let fallbackMsgId: string | null = null
        for (let i = session.messages.length - 1; i >= 0; i--) {
          if (session.messages[i].role === 'assistant') {
            fallbackMsgId = session.messages[i].id
            break
          }
        }
        if (fallbackMsgId && data.tool_call_id) {
          const orphanTool: ToolCall = {
            id: data.tool_call_id,
            type: 'function',
            function: { name: 'unknown', arguments: '{}' },
            status: 'success',
            output: data.content || '',
            endTime: Date.now(),
          }
          addToolCall(activeSessionId, fallbackMsgId, orphanTool)
        }
        // NOTE: we do NOT add a separate message for tool results.
        // The output is always folded into the ToolCallCard.
      }

      // ── Thinking content ──
      else if (data.role === 'thinking' && data.content) {
        const session = useAppStore.getState().sessions.find((s) => s.id === activeSessionId)
        if (!session) return
        const lastMsg = session.messages[session.messages.length - 1]

        // Try to append to an existing streaming thinking block
        if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
          const streamingThinkingBlock = lastMsg.thinkingBlocks?.find((b) => b.isStreaming)
          if (streamingThinkingBlock) {
            // Append to existing thinking block
            appendToThinkingBlock(activeSessionId, streamingThinkingBlock.id, data.content)
          } else {
            // Create a new thinking block
            const block: ThinkingBlock = {
              id: 'thinking-' + Date.now(),
              content: data.content,
              startTime: Date.now(),
              isStreaming: true,
            }
            addThinkingBlock(activeSessionId, lastMsg.id, block)
          }
        } else {
          // Create new assistant message with thinking block
          const block: ThinkingBlock = {
            id: 'thinking-' + Date.now(),
            content: data.content,
            startTime: Date.now(),
            isStreaming: true,
          }
          addMessage(activeSessionId, 'assistant', '')
          // After message is created, add the thinking block
          const updatedSession = useAppStore.getState().sessions.find((s) => s.id === activeSessionId)
          const newMsg = updatedSession?.messages[updatedSession.messages.length - 1]
          if (newMsg) {
            addThinkingBlock(activeSessionId, newMsg.id, block)
          }
        }
      }

      // ── Meta events (session resume hint) ──
      // Handled by onSession callback
    })

    const unsubDone = window.api.kimi.onDone(() => {
      if (activeSessionId) {
        // Mark any remaining running tools as completed
        const session = useAppStore.getState().sessions.find((s) => s.id === activeSessionId)
        if (session) {
          for (const m of session.messages) {
            for (const tc of m.toolCalls || []) {
              if (tc.status === 'running') {
                updateToolStatus(activeSessionId, tc.id, 'success', tc.output || '')
              }
            }
          }
        }
        finalizeStreaming(activeSessionId)
      }
      setStreaming(false)
      setCancelled(false)
    })

    const unsubError = window.api.kimi.onError?.((message: string) => {
      if (activeSessionId) {
        addMessage(activeSessionId, 'system', `错误: ${message}`)
        finalizeStreaming(activeSessionId)
      }
      setStreaming(false)
    })

    const unsubSession = window.api.kimi.onSession?.((info) => {
      if (activeSessionId) {
        setKimiSessionId(activeSessionId, info.id)
        const store = useAppStore.getState()
        const session = store.sessions.find((s) => s.id === activeSessionId)
        if (session) {
          const firstUser = session.messages.find((m) => m.role === 'user')
          if (firstUser) {
            const title = firstUser.content.slice(0, 30) + (firstUser.content.length > 30 ? '...' : '')
            updateSessionTitle(activeSessionId, title)
          }
        }
      }
    })

    // Approval requests from kimi-code CLI
    const unsubApproval = window.api.kimi.onApprovalRequest?.((data) => {
      const approval: ApprovalRequest = {
        type: 'approval_request',
        id: data.id,
        tool_name: data.tool_name,
        action: data.action,
        display: Array.isArray(data.display) ? data.display : [],
      }
      setPendingApproval(approval)
    })

    // Stderr carries tool.progress updates and diagnostics in prompt mode
    const unsubStderr = window.api.kimi.onStderr?.((line: string) => {
      if (!line.trim()) return
      appendStderrLog(line)
    })

    return () => {
      unsubStream()
      unsubDone()
      unsubError?.()
      unsubSession?.()
      unsubApproval?.()
      unsubStderr?.()
    }
  }, [activeSessionId])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      // Ensure we have a session
      let sessionId = activeSessionId
      if (!sessionId) {
        const store = useAppStore.getState()
        sessionId = store.createSession(settings.workDir || undefined)
      }

      // Add user message
      addMessage(sessionId, 'user', content)
      clearStderrLog()
      setStreaming(true)

      // Get kimi session ID for resume
      const store = useAppStore.getState()
      const session = store.sessions.find((s) => s.id === sessionId)

      try {
        const opts: Record<string, string> = {}
        if (settings.model && settings.model !== 'default') opts.model = settings.model
        // Prefer the session's original workDir so resumed sessions use the
        // directory they were created in, not the current GUI process cwd.
        const workDir = session?.workDir || settings.workDir
        if (workDir) opts.workDir = workDir
        if (settings.permissionMode) opts.permissionMode = settings.permissionMode
        if (settings.kimiPath) opts.kimiPath = settings.kimiPath
        if (session?.kimiSessionId) opts.sessionId = session.kimiSessionId
        await window.api.kimi.send(content, opts)
      } catch (err: any) {
        const msg = categorizeError(err)
        addMessage(sessionId, 'system', `错误: ${msg}`)
        setStreaming(false)
      }
    },
    [activeSessionId, isStreaming, settings]
  )

  const cancelMessage = useCallback(async () => {
    if (!window.api?.kimi) return
    setCancelled(true)
    await window.api.kimi.cancel()
    if (activeSessionId) {
      finalizeStreaming(activeSessionId)
    }
    setStreaming(false)
  }, [activeSessionId])

  return { sendMessage, cancelMessage, isStreaming }
}

function categorizeError(err: any): string {
  const msg = String(err?.message || err || '')
  if (msg.includes('ENOENT') || msg.includes('spawn')) {
    return 'kimi CLI 未找到。请在设置中配置正确的 kimi 路径。'
  }
  if (msg.includes('EACCES') || msg.includes('permission')) {
    return '没有权限执行 kimi CLI。请检查文件权限。'
  }
  if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) {
    return '连接超时。请检查网络状态。'
  }
  return msg || '未知错误'
}
