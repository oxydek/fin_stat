import React, { useState, useEffect } from 'react'
import { prisma } from '../lib/database'

interface Notification {
  id: string
  title: string
  message?: string
  type: 'info' | 'success' | 'warning' | 'error'
  autoClose?: boolean
  duration?: number
}

interface NotificationSystemProps {
  children: React.ReactNode
}

export function NotificationSystem({ children }: NotificationSystemProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    checkReminders()
    const interval = setInterval(checkReminders, 60000) // проверяем каждую минуту
    return () => clearInterval(interval)
  }, [])

  const checkReminders = async () => {
    try {
      const now = new Date()
      const remindersDue = await prisma.reminder.findMany({
        where: {
          isActive: true,
          nextDate: {
            lte: now
          }
        },
        include: {
          goal: {
            select: { name: true, icon: true }
          }
        }
      })

      for (const reminder of remindersDue) {
        // Показываем уведомление
        addNotification({
          id: `reminder-${reminder.id}`,
          title: reminder.title,
          message: reminder.message || undefined,
          type: 'info',
          autoClose: false
        })

        // Обновляем следующую дату для повторяющихся напоминаний
        if (reminder.frequency !== 'once') {
          const nextDate = calculateNextDate(reminder.nextDate, reminder.frequency)
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { nextDate }
          })
        } else {
          // Деактивируем разовые напоминания
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { isActive: false }
          })
        }
      }
    } catch (error) {
      console.error('Ошибка проверки напоминаний:', error)
    }
  }

  const calculateNextDate = (currentDate: Date, frequency: string): Date => {
    const date = new Date(currentDate)
    
    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + 1)
        break
      case 'weekly':
        date.setDate(date.getDate() + 7)
        break
      case 'monthly':
        date.setMonth(date.getMonth() + 1)
        break
      default:
        date.setDate(date.getDate() + 1)
    }
    
    return date
  }

  const addNotification = (notification: Omit<Notification, 'id'> & { id?: string }) => {
    const newNotification: Notification = {
      id: notification.id || Date.now().toString(),
      autoClose: true,
      duration: 5000,
      ...notification
    }

    setNotifications(prev => [...prev, newNotification])

    if (newNotification.autoClose) {
      setTimeout(() => {
        removeNotification(newNotification.id)
      }, newNotification.duration)
    }
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const getNotificationStyles = (type: string) => {
    const baseStyles = "rounded-ios shadow-ios-card border p-4 mb-3 transition-all duration-300"
    
    switch (type) {
      case 'success':
        return `${baseStyles} bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200`
      case 'warning':
        return `${baseStyles} bg-yellow-50 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200`
      case 'error':
        return `${baseStyles} bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200`
      default:
        return `${baseStyles} bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200`
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅'
      case 'warning':
        return '⚠️'
      case 'error':
        return '❌'
      default:
        return 'ℹ️'
    }
  }

  // Экспортируем функцию для использования в других компонентах
  React.useEffect(() => {
    (window as any).showNotification = addNotification
  }, [])

  return (
    <>
      {children}
      
      {/* Notifications Container */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={getNotificationStyles(notification.type)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <span className="text-lg">
                    {getNotificationIcon(notification.type)}
                  </span>
                  <div className="flex-1">
                    <h4 className="font-medium">{notification.title}</h4>
                    {notification.message && (
                      <p className="text-sm mt-1 opacity-90">{notification.message}</p>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="ml-2 text-current opacity-50 hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
} 