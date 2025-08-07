import React, { useState } from 'react'
import { Modal } from './Modal'

interface AddGoalModalProps {
  isOpen: boolean
  onClose: () => void
  onGoalAdded: () => void
}

const colors = [
  '#007AFF', '#34C759', '#5856D6', '#FF9500',
  '#FF2D92', '#AF52DE', '#FF3B30', '#5AC8FA',
  '#FFCC00', '#8E8E93'
]

const icons = ['🎯', '🏠', '🚗', '✈️', '💻', '📱', '👕', '🎓', '💍', '🎮']

export function AddGoalModal({ isOpen, onClose, onGoalAdded }: AddGoalModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetAmount: 0,
    targetDate: '',
    icon: '🎯',
    color: '#007AFF'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!formData.name.trim()) {
        throw new Error('Название цели обязательно')
      }

      if (formData.targetAmount <= 0) {
        throw new Error('Целевая сумма должна быть больше 0')
      }

      const goalData: any = {
        name: formData.name.trim(),
        targetAmount: formData.targetAmount,
        icon: formData.icon,
        color: formData.color,
      }

      if (formData.description.trim()) {
        goalData.description = formData.description.trim()
      }

      if (formData.targetDate) {
        // отправляем строку даты; на сервере она будет преобразована в Date
        goalData.targetDate = formData.targetDate
      }

      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalData)
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Не удалось создать цель')
      }

      // Reset form
      setFormData({
        name: '',
        description: '',
        targetAmount: 0,
        targetDate: '',
        icon: '🎯',
        color: '#007AFF'
      })

      onGoalAdded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Новая цель">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Название цели *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue"
            placeholder="Например, Отпуск в Италии"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Описание (необязательно)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue resize-none"
            placeholder="Краткое описание цели"
            rows={3}
          />
        </div>

        {/* Target Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Целевая сумма *
          </label>
          <input
            type="number"
            step="1"
            min="1"
            value={formData.targetAmount || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, targetAmount: parseInt(e.target.value) || 0 }))}
            className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue"
            placeholder="100000"
            required
          />
          {formData.targetAmount > 0 && (
            <p className="text-sm text-ios-gray dark:text-gray-400 mt-1">
              {formatAmount(formData.targetAmount)}
            </p>
          )}
        </div>

        {/* Target Date */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Целевая дата (необязательно)
          </label>
          <input
            type="date"
            value={formData.targetDate}
            onChange={(e) => setFormData(prev => ({ ...prev, targetDate: e.target.value }))}
            className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Icon & Color */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Иконка
            </label>
            <div className="grid grid-cols-5 gap-2">
              {icons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, icon }))}
                  className={`w-10 h-10 flex items-center justify-center rounded-ios border text-2xl leading-none transition-colors ${
                    formData.icon === icon
                      ? 'border-ios-blue bg-ios-blue bg-opacity-10'
                      : 'border-ios-gray5 dark:border-gray-600 hover:bg-ios-gray6 dark:hover:bg-gray-700'
                  }`}
                  title={icon}
                >
                  <span className="leading-none">{icon}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Цвет
            </label>
            <div className="grid grid-cols-5 gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color }))}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    formData.color === color ? 'border-gray-900 dark:border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-ios-gray6 dark:bg-gray-700 rounded-ios p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                style={{ backgroundColor: formData.color }}
              >
                <span className="text-white leading-none">{formData.icon}</span>
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {formData.name || 'Название цели'}
                </div>
                {formData.description && (
                  <div className="text-sm text-ios-gray dark:text-gray-400">
                    {formData.description}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-ios-gray dark:text-gray-400">
              Цель: {formData.targetAmount > 0 ? formatAmount(formData.targetAmount) : '0 ₽'}
            </span>
            {formData.targetDate && (
              <span className="text-ios-gray dark:text-gray-400">
                {new Date(formData.targetDate).toLocaleDateString('ru-RU')}
              </span>
            )}
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
            className="flex-1 py-3 px-4 rounded-ios bg-ios-green hover:bg-green-600 text-white font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Создание...' : 'Создать цель'}
          </button>
        </div>
      </form>
    </Modal>
  )
} 