import { Plus, MessageSquare, Settings, Trash2 } from 'lucide-react'
import { useAppStore } from '@/stores/app'

interface SidebarProps {
  onOpenSettings: () => void
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  const sessions = useAppStore((s) => s.sessions)
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const createSession = useAppStore((s) => s.createSession)
  const setActiveSession = useAppStore((s) => s.setActiveSession)
  const deleteSession = useAppStore((s) => s.deleteSession)

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Kimi Code</h2>
        <div className="sidebar-actions">
          <button
            className="icon-btn"
            onClick={() => createSession()}
            title="新对话"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="sidebar-list">
        {sessions.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
            还没有对话
            <br />
            点击 + 开始新对话
          </div>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
              onClick={() => setActiveSession(session.id)}
            >
              <MessageSquare size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
              <span className="session-item-title">{session.title}</span>
              <span
                className="session-item-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteSession(session.id)
                }}
              >
                <Trash2 size={14} />
              </span>
            </button>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <button className="icon-btn" onClick={onOpenSettings} title="设置">
          <Settings size={18} />
        </button>
      </div>
    </aside>
  )
}
