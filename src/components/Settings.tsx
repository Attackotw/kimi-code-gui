import { ArrowLeft } from 'lucide-react'
import { useAppStore } from '@/stores/app'

interface SettingsProps {
  onBack: () => void
}

export function Settings({ onBack }: SettingsProps) {
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>返回聊天</span>
        </button>
        <h1>设置</h1>
      </div>

      <div className="settings-body">
        {/* 模型 */}
        <div className="settings-section">
          <h2>模型</h2>
          <div className="settings-row">
            <div>
              <div className="settings-label">默认模型</div>
              <div className="settings-description">选择 kimi-code 使用的模型</div>
            </div>
            <div className="settings-control">
              <select
                className="select-input"
                value={settings.model}
                onChange={(e) => updateSettings({ model: e.target.value })}
              >
                <option value="default">默认</option>
                <option value="kimi-k2">Kimi K2</option>
                <option value="moonshot-v1-128k">Moonshot V1 128K</option>
              </select>
            </div>
          </div>
        </div>

        {/* 工作目录 */}
        <div className="settings-section">
          <h2>工作目录</h2>
          <div className="settings-row">
            <div>
              <div className="settings-label">项目路径</div>
              <div className="settings-description">kimi-code 的工作目录</div>
            </div>
            <div className="settings-control" style={{ display: 'flex', gap: 8 }}>
              <input
                className="text-input"
                value={settings.workDir}
                onChange={(e) => updateSettings({ workDir: e.target.value })}
                placeholder="留空使用当前目录"
                style={{ width: 180 }}
              />
              <button
                onClick={async () => {
                  if (!window.api?.dialog) return
                  const dir = await window.api.dialog.openDirectory()
                  if (dir) updateSettings({ workDir: dir })
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--input)',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
              >
                浏览
              </button>
            </div>
          </div>
        </div>

        {/* 权限模式 */}
        <div className="settings-section">
          <h2>权限</h2>
          <div className="settings-row">
            <div>
              <div className="settings-label">操作权限</div>
              <div className="settings-description">控制 kimi-code 对文件系统的访问级别</div>
            </div>
            <div className="settings-control">
              <div className="segmented-control">
                {(['default', 'auto', 'yolo'] as const).map((mode) => (
                  <button
                    key={mode}
                    className={`segmented-btn ${settings.permissionMode === mode ? 'active' : ''}`}
                    onClick={() => updateSettings({ permissionMode: mode })}
                  >
                    {mode === 'default' ? '默认' : mode === 'auto' ? '自动' : '完全访问'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 外观 */}
        <div className="settings-section">
          <h2>外观</h2>
          <div className="settings-row">
            <div>
              <div className="settings-label">主题</div>
              <div className="settings-description">选择界面配色方案</div>
            </div>
            <div className="settings-control">
              <div className="segmented-control">
                {(['system', 'light', 'dark'] as const).map((t) => (
                  <button
                    key={t}
                    className={`segmented-btn ${settings.theme === t ? 'active' : ''}`}
                    onClick={() => updateSettings({ theme: t })}
                  >
                    {t === 'system' ? '跟随系统' : t === 'light' ? '浅色' : '深色'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-label">字体大小</div>
              <div className="settings-description">消息区域的字体大小</div>
            </div>
            <div className="settings-control" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min={12}
                max={20}
                value={settings.fontSize}
                onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                style={{ width: 120 }}
              />
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)', width: 32, textAlign: 'right' }}>
                {settings.fontSize}px
              </span>
            </div>
          </div>
        </div>

        {/* 关于 */}
        <div className="settings-section">
          <h2>关于</h2>
          <div className="settings-row">
            <div>
              <div className="settings-label">版本</div>
              <div className="settings-description">Kimi Code GUI v0.1.0</div>
            </div>
          </div>
        </div>

        {/* CLI */}
        <div className="settings-section">
          <h2>CLI</h2>
          <div className="settings-row">
            <div>
              <div className="settings-label">kimi 路径</div>
              <div className="settings-description">kimi-code CLI 可执行文件路径，留空使用 PATH</div>
            </div>
            <div className="settings-control">
              <input
                className="text-input"
                value={settings.kimiPath}
                onChange={(e) => updateSettings({ kimiPath: e.target.value })}
                placeholder="kimi"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
