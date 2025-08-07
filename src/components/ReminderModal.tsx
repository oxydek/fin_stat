import React, { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { prisma } from '../lib/database'

interface ReminderModalProps {
  isOpen: boolean
  onClose: () => void
  onReminderAdded: () => void
}

interface Goal {
  id: string
  name: string
  icon?: string
  color?: string
}

const reminderTypes = [
  { value: 'goal', label: 'Напоминание о цели', icon: '🎯' },
  { value: 'payment', label: 'Напоминание о платеже', icon: '💳' },
  { value: 'custom', label: 'Произвольное напоминание', icon: '⏰' },
]

const frequencies = [
  { value: 'once', label: 'Один раз' },
  { value: 'daily', label: 'Ежедневно' },
  { value: 'weekly', label: 'Еженедельно' },
  { value: 'monthly', label: 'Ежемесячно' },
]

export function ReminderModal({ isOpen, onClose, onReminderAdded }: ReminderModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'goal',
    frequency: 'once',
    nextDate: '',
    goalId: ''
  })
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadGoals()
    }
  }, [isOpen])

  const loadGoals = async () => {
    try {
      const goalsData = await prisma.goal.findMany({
        where: { isActive: true, isCompleted: false },
        select: { id: true, name: true, icon: true, color: true }
      })
      setGoals(goalsData.map(goal => ({
        ...goal,
        icon: goal.icon || undefined,
        color: goal.color || undefined
      })))
      
      if (goalsData.length > 0 && formData.type === 'goal') {
        setFormData(prev => ({ ...prev, goalId: goalsData[0].id }))
      }
    } catch (error) {
      console.error('Ошибка загрузки целей:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!formData.title.trim()) {
        throw new Error('Заголовок напоминания обязателен')
      }

      if (!formData.nextDate) {
        throw new Error('Дата напоминания обязательна')
      }

      const reminderData: any = {
        title: formData.title.trim(),
        type: formData.type,
        frequency: formData.frequency,
        nextDate: new Date(formData.nextDate),
      }

      if (formData.message.trim()) {
        reminderData.message = formData.message.trim()
      }

      if (formData.type === 'goal' && formData.goalId) {
        reminderData.goalId = formData.goalId
      }

      await prisma.reminder.create({ data: reminderData })

      // Reset form
      setFormData({
        title: '',
        message: '',
        type: 'goal',
        frequency: 'once',
        nextDate: '',
        goalId: goals.length > 0 ? goals[0].id : ''
      })

      onReminderAdded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleTypeChange = (type: string) => {
    setFormData(prev => ({ 
      ...prev, 
      type,
      goalId: type === 'goal' && goals.length > 0 ? goals[0].id : ''
    }))
  }

  const getMinDate = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 5) // минимум через 5 минут
    return now.toISOString().slice(0, 16)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Новое напоминание">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Тип напоминания
          </label>
          <div className="space-y-2">
            {reminderTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleTypeChange(type.value)}
                className={`w-full p-3 rounded-ios border text-left transition-colors ${
                  formData.type === type.value
                    ? 'border-ios-blue bg-ios-blue bg-opacity-10 text-ios-blue'
                    : 'border-ios-gray5 dark:border-gray-600 hover:bg-ios-gray6 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{type.icon}</span>
                  <span className="font-medium">{type.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Goal selection (if type is goal) */}
        {formData.type === 'goal' && goals.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Выберите цель
            </label>
            <select
              value={formData.goalId}
              onChange={(e) => setFormData(prev => ({ ...prev, goalId: e.target.value }))}
              className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue"
            >
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.icon} {goal.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Заголовок *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue"
            placeholder="Например, Пополнить цель на отпуск"
            required
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Сообщение (необязательно)
          </label>
          <textarea
            value={formData.message}
            onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
            className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue resize-none"
            placeholder="Дополнительная информация для напоминания"
            rows={3}
          />
        </div>

        {/* Date and Time */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Дата и время *
          </label>
          <input
            type="datetime-local"
            value={formData.nextDate}
            onChange={(e) => setFormData(prev => ({ ...prev, nextDate: e.target.value }))}
            className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue"
            min={getMinDate()}
            required
          />
        </div>

        {/* Frequency */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Частота повторения
          </label>
          <select
            value={formData.frequency}
            onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value }))}
            className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue"
          >
            {frequencies.map((freq) => (
              <option key={freq.value} value={freq.value}>
                {freq.label}
              </option>
            ))}
          </select>
        </div>

        {/* Preview */}
        <div className="bg-ios-gray6 dark:bg-gray-700 rounded-ios p-4">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">
              {reminderTypes.find(t => t.value === formData.type)?.icon}
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-white">
                {formData.title || 'Заголовок напоминания'}
              </div>
              {formData.message && (
                <div className="text-sm text-ios-gray dark:text-gray-400 mt-1">
                  {formData.message}
                </div>
              )}
              <div className="flex items-center space-x-2 mt-2 text-sm text-ios-gray dark:text-gray-400">
                <span>
                  {formData.nextDate ? 
                    new Date(formData.nextDate).toLocaleString('ru-RU') : 
                    'Выберите дату'
                  }
                </span>
                <span>•</span>
                <span>
                  {frequencies.find(f => f.value === formData.frequency)?.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-ios p-3">
            <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-ios border border-ios-gray5 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-ios-gray6 dark:hover:bg-gray-700 transition-colors"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-ios bg-ios-purple hover:bg-purple-600 text-white font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Создание...' : 'Создать напоминание'}
          </button>
        </div>
      </form>
    </Modal>
  )
} 