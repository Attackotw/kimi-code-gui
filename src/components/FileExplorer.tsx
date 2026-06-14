import { useState, useEffect, useCallback } from 'react'
import { Folder, FolderOpen, File, X, RefreshCw } from 'lucide-react'
import { useAppStore } from '@/stores/app'
import type { FileEntry } from '@/types'

interface FileTreeItemProps {
  entry: FileEntry
  depth: number
}

function FileTreeItem({ entry, depth }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileEntry[]>([])
  const [, setLoading] = useState(false)

  const loadChildren = useCallback(async () => {
    if (!window.api?.fs) return
    setLoading(true)
    try {
      const entries = await window.api.fs.readDir(entry.path)
      setChildren(entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      }))
    } catch {
      setChildren([])
    }
    setLoading(false)
  }, [entry.path])

  const toggle = async () => {
    if (!entry.isDirectory) return
    if (!expanded && children.length === 0) {
      await loadChildren()
    }
    setExpanded(!expanded)
  }

  return (
    <div>
      <button
        className="file-tree-item"
        onClick={toggle}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {entry.isDirectory ? (
          expanded ? (
            <FolderOpen size={16} className="file-tree-item-icon" style={{ color: 'var(--status-info)' }} />
          ) : (
            <Folder size={16} className="file-tree-item-icon" style={{ color: 'var(--status-info)' }} />
          )
        ) : (
          <File size={16} className="file-tree-item-icon" />
        )}
        <span className="file-tree-item-name">{entry.name}</span>
      </button>
      {expanded && children.length > 0 && (
        <div className="file-tree-children">
          {children.map((child) => (
            <FileTreeItem key={child.path} entry={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileExplorer() {
  const rootDir = useAppStore((s) => s.rootDir)
  const setRootDir = useAppStore((s) => s.setRootDir)
  const setRightPanel = useAppStore((s) => s.setRightPanel)
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)

  const loadRoot = useCallback(async () => {
    if (!rootDir || !window.api?.fs) return
    setLoading(true)
    try {
      const entries = await window.api.fs.readDir(rootDir)
      setRootEntries(entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      }))
    } catch {
      setRootEntries([])
    }
    setLoading(false)
  }, [rootDir])

  useEffect(() => {
    loadRoot()
  }, [loadRoot])

  const handleOpenFolder = async () => {
    if (!window.api?.dialog) return
    const dir = await window.api.dialog.openDirectory()
    if (dir) setRootDir(dir)
  }

  return (
    <aside className="right-panel">
      <div className="right-panel-header">
        <h3>文件</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="icon-btn" onClick={loadRoot} title="刷新">
            <RefreshCw size={16} />
          </button>
          <button className="icon-btn" onClick={() => setRightPanel(null)} title="关闭">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="right-panel-content">
        {!rootDir ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <p style={{ color: 'var(--muted-foreground)', fontSize: 13, marginBottom: 12 }}>
              未打开文件夹
            </p>
            <button
              onClick={handleOpenFolder}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--input)',
                background: 'var(--background)',
                color: 'var(--foreground)',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            >
              打开文件夹
            </button>
          </div>
        ) : (
          <>
            <div style={{ padding: '8px', fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Folder size={14} />
              <span className="truncate" style={{ flex: 1 }}>{rootDir.split('/').pop()}</span>
            </div>
            {loading ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
                加载中…
              </div>
            ) : (
              rootEntries.map((entry) => (
                <FileTreeItem key={entry.path} entry={entry} depth={0} />
              ))
            )}
          </>
        )}
      </div>
    </aside>
  )
}
