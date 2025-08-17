import React, { useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { NotificationSystem } from './components/NotificationSystem'
import { ReminderModal } from './components/ReminderModal'

function App() {
  const getInitialTheme = () => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'dark') return true
      if (saved === 'light') return false
    } catch {}
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  }

  const [isDark, setIsDark] = useState(getInitialTheme())
  const [showReminder, setShowReminder] = useState(false)

  // PWA install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [canInstall, setCanInstall] = useState(false)

  React.useEffect(() => {
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light')
    } catch {}
    try {
      const root = document.documentElement
      if (isDark) root.classList.add('dark')
      else root.classList.remove('dark')
    } catch {}
  }, [isDark])

  React.useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler as any)
    return () => window.removeEventListener('beforeinstallprompt', handler as any)
  }, [])

  const onClickInstall = async () => {
    try {
      // iOS Safari не поддерживает beforeinstallprompt
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (window.navigator as any).standalone
      if (isIOS && !isStandalone) {
        try { (window as any).showNotification?.({ title: 'Установка на iPhone', message: 'Нажмите Поделиться → Добавить на экран “Домой”', type: 'info', autoClose: false }) } catch {}
        return
      }
      if (!deferredPrompt) return
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      setCanInstall(false)
      try {
        (window as any).showNotification?.({ title: outcome === 'accepted' ? 'Приложение установлено' : 'Установка отменена', type: outcome === 'accepted' ? 'success' : 'warning' })
      } catch {}
    } catch (e:any) {
      try { (window as any).showNotification?.({ title: 'Ошибка установки', message: e?.message || String(e), type: 'error' }) } catch {}
    }
  }

  const reloadData = () => {
    // Функция для перезагрузки данных после создания напоминания
    window.location.reload()
  }

  return (
    <NotificationSystem>
      <div className={`min-h-screen ${isDark ? 'dark' : ''}`}>
        <div className="min-h-screen bg-ios-gray6 dark:bg-gray-900 font-sf">
          {/* Header */}
          <header className="bg-white dark:bg-gray-800 shadow-ios border-b border-ios-gray5 dark:border-gray-700">
            <div className="px-6 py-4 flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                FinStat
              </h1>
              
              <div className="flex items-center space-x-3">
                {canInstall && (
                  <button
                    onClick={onClickInstall}
                    className="p-2 rounded-ios bg-ios-blue text-white hover:bg-blue-600 transition-colors"
                    title="Установить приложение"
                  >
                    ⬇️
                  </button>
                )}
                <button
                  onClick={() => setShowReminder(true)}
                  className="p-2 rounded-ios bg-ios-purple text-white hover:bg-purple-600 transition-colors"
                  title="Создать напоминание"
                >
                  ⏰
                </button>
                
                <button
                  onClick={() => setIsDark(!isDark)}
                  className="p-2 rounded-ios bg-ios-gray5 dark:bg-gray-700 text-ios-blue dark:text-white hover:bg-ios-gray4 dark:hover:bg-gray-600 transition-colors"
                >
                  {isDark ? '☀️' : '🌙'}
                </button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="p-6">
            <Dashboard />
            {/* iOS hint inline on mobile if not installable */}
            <div className="mt-4 sm:hidden text-xs text-ios-gray dark:text-gray-400">
              Для установки на iPhone: Поделиться → Добавить на экран «Домой»
            </div>
          </main>
        </div>
      </div>

      {/* Reminder Modal */}
      <ReminderModal
        isOpen={showReminder}
        onClose={() => setShowReminder(false)}
        onReminderAdded={reloadData}
      />
    </NotificationSystem>
  )
}

export default App 