import React, { useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { NotificationSystem } from './components/NotificationSystem'
import { ReminderModal } from './components/ReminderModal'

function App() {
  const [isDark, setIsDark] = useState(false)
  const [showReminder, setShowReminder] = useState(false)

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