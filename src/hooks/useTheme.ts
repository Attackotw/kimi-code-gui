import { useEffect } from 'react'
import { useAppStore } from '@/stores/app'

export function useTheme() {
  const theme = useAppStore((s) => s.settings.theme)

  useEffect(() => {
    const root = document.documentElement

    const apply = (dark: boolean) => {
      root.setAttribute('data-theme', dark ? 'dark' : 'light')
    }

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
      const handler = (e: MediaQueryListEvent) => apply(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }

    apply(theme === 'dark')
  }, [theme])
}
