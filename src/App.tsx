import { useState, useEffect } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { Sidebar } from '@/components/Sidebar'
import { ChatPanel } from '@/components/ChatPanel'
import { FileExplorer } from '@/components/FileExplorer'
import { Terminal } from '@/components/Terminal'
import { Settings } from '@/components/Settings'
import { useAppStore, loadPersistedState } from '@/stores/app'

export default function App() {
  useTheme()
  const [view, setView] = useState<'chat' | 'settings'>('chat')
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const rightPanel = useAppStore((s) => s.rightPanel)
  const setHydrated = useAppStore((s) => s.setHydrated)
  const hydrated = useAppStore((s) => s._hydrated)

  // Hydrate from persistent storage on mount
  useEffect(() => {
    loadPersistedState().then((persisted) => {
      if (persisted.sessions || persisted.settings) {
        useAppStore.setState(persisted)
      }
      setHydrated(true)
    })
  }, [])

  if (!hydrated) {
    return (
      <div className="app-layout" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>加载中…</span>
      </div>
    )
  }

  if (view === 'settings') {
    return (
      <div className="app-layout">
        <Sidebar onOpenSettings={() => setView('settings')} />
        <Settings onBack={() => setView('chat')} />
      </div>
    )
  }

  return (
    <div className="app-layout">
      {sidebarOpen && <Sidebar onOpenSettings={() => setView('settings')} />}
      <ChatPanel />
      {rightPanel === 'files' && <FileExplorer />}
      {rightPanel === 'terminal' && <Terminal />}
    </div>
  )
}
