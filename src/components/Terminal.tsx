import { useRef, useEffect, useCallback } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useAppStore } from '@/stores/app'

export function Terminal() {
  const setRightPanel = useAppStore((s) => s.setRightPanel)
  const rootDir = useAppStore((s) => s.rootDir)
  const stderrLog = useAppStore((s) => s.stderrLog)
  const clearStderrLog = useAppStore((s) => s.clearStderrLog)
  const termRef = useRef<HTMLDivElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  // Start pty process
  useEffect(() => {
    if (startedRef.current || !window.api?.terminal) return
    startedRef.current = true

    const cwd = rootDir || process.env.HOME || '/'
    window.api.terminal.start(cwd).then((result) => {
      if (!result.ok) {
        // node-pty not available — show message
        if (termRef.current) {
          termRef.current.textContent = `终端不可用: ${result.error || 'node-pty 未安装'}\n运行 npm install node-pty 后重启。`
        }
      }
    })

    const unsubData = window.api.terminal.onData((data) => {
      if (termRef.current) {
        // Simple terminal rendering — append text, handle basic ANSI
        const cleaned = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
        termRef.current.textContent += cleaned
        termRef.current.scrollTop = termRef.current.scrollHeight
      }
    })

    const unsubExit = window.api.terminal.onExit(() => {
      if (termRef.current) {
        termRef.current.textContent += '\n[进程已退出]'
      }
    })

    return () => {
      unsubData()
      unsubExit()
      window.api?.terminal?.kill()
      startedRef.current = false
    }
  }, [rootDir])

  const handleInput = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!window.api?.terminal) return
    const textarea = e.currentTarget

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const value = textarea.value
      window.api.terminal.write(value + '\n')
      textarea.value = ''
    } else if (e.key === 'Tab') {
      e.preventDefault()
      window.api.terminal.write('\t')
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault()
      window.api.terminal.write('\x03')
    }
  }, [])

  const handleClear = useCallback(() => {
    clearStderrLog()
    if (termRef.current) {
      termRef.current.textContent = ''
    }
  }, [clearStderrLog])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [stderrLog])

  return (
    <aside className="right-panel">
      <div className="right-panel-header">
        <h3>终端</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="icon-btn" onClick={handleClear} title="清除终端和运行时日志">
            <Trash2 size={16} />
          </button>
          <button className="icon-btn" onClick={() => setRightPanel(null)} title="关闭">
            <X size={16} />
          </button>
        </div>
      </div>
      {stderrLog.length > 0 && (
        <div
          ref={logRef}
          className="terminal-stderr-log"
          style={{
            flex: '0 0 auto',
            maxHeight: '35%',
            overflowY: 'auto',
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            fontSize: 12,
            fontFamily: "ui-monospace, 'JetBrains Mono', Menlo, monospace",
            color: 'var(--muted-foreground)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {stderrLog.map((line, i) => (
            <div key={i}>{line.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')}</div>
          ))}
        </div>
      )}
      <div className="terminal-container" ref={termRef} />
      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)' }}>
        <textarea
          onKeyDown={handleInput}
          placeholder="输入命令… (Enter 发送)"
          rows={1}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--foreground)',
            fontFamily: "ui-monospace, 'JetBrains Mono', Menlo, monospace",
            fontSize: 13,
            resize: 'none',
          }}
        />
      </div>
    </aside>
  )
}
