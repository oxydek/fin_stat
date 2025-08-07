import React, { useState } from 'react'
import { Modal } from './Modal'
import { prisma } from '../lib/database'

interface AddAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onAccountAdded: () => void
}

const accountTypes = [
  { value: 'card', label: 'Банковская карта', icon: '💳', color: '#007AFF' },
  { value: 'cash', label: 'Наличные', icon: '💵', color: '#34C759' },
  { value: 'deposit', label: 'Вклад', icon: '🏦', color: '#5856D6' },
  { value: 'crypto', label: 'Криптовалюта', icon: '₿', color: '#FF9500' },
]

const currencies = [
  { value: 'RUB', label: '₽ Рубль' },
  { value: 'USD', label: '$ Доллар' },
  { value: 'EUR', label: '€ Евро' },
]

const colors = [
  '#007AFF', '#34C759', '#5856D6', '#FF9500',
  '#FF2D92', '#AF52DE', '#FF3B30', '#5AC8FA',
  '#FFCC00', '#8E8E93'
]

const icons = ['💳', '💵', '🏦', '₿', '💰', '🎯', '📊', '💼', '🔒', '⭐']

export function AddAccountModal({ isOpen, onClose, onAccountAdded }: AddAccountModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'card',
    balance: 0,
    currency: 'RUB',
    icon: '💳',
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
        throw new Error('Название счета обязательно')
      }

      await prisma.account.create({
        data: {
          name: formData.name.trim(),
          type: formData.type,
          balance: formData.balance,
          currency: formData.currency,
          icon: formData.icon,
          color: formData.color,
        }
      })

      // Reset form
      setFormData({
        name: '',
        type: 'card',
        balance: 0,
        currency: 'RUB',
        icon: '💳',
        color: '#007AFF'
      })

      onAccountAdded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleTypeChange = (type: string) => {
    const accountType = accountTypes.find(t => t.value === type)
    if (accountType) {
      setFormData(prev => ({
        ...prev,
        type,
        icon: accountType.icon,
        color: accountType.color
      }))
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Добавить счет">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Название счета *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue"
            placeholder="Например, Основная карта"
            required
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Тип счета
          </label>
          <div className="grid grid-cols-2 gap-2">
            {accountTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleTypeChange(type.value)}
                className={`p-3 rounded-ios border text-left transition-colors ${
                  formData.type === type.value
                    ? 'border-ios-blue bg-ios-blue bg-opacity-10 text-ios-blue'
                    : 'border-ios-gray5 dark:border-gray-600 hover:bg-ios-gray6 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-xl">{type.icon}</span>
                  <span className="text-sm font-medium">{type.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Balance */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Начальный баланс
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.balance}
            onChange={(e) => setFormData(prev => ({ ...prev, balance: parseFloat(e.target.value) || 0 }))}
            className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue"
            placeholder="0"
          />
        </div>

        {/* Currency */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Валюта
          </label>
          <select
            value={formData.currency}
            onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
            className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue"
          >
            {currencies.map((currency) => (
              <option key={currency.value} value={currency.value}>
                {currency.label}
              </option>
            ))}
          </select>
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
                  className={`p-2 rounded-ios border text-xl transition-colors ${
                    formData.icon === icon
                      ? 'border-ios-blue bg-ios-blue bg-opacity-10'
                      : 'border-ios-gray5 dark:border-gray-600 hover:bg-ios-gray6 dark:hover:bg-gray-700'
                  }`}
                >
                  {icon}
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
          <div className="flex items-center space-x-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ backgroundColor: formData.color }}
            >
              <span className="text-white">{formData.icon}</span>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {formData.name || 'Название счета'}
              </div>
              <div className="text-sm text-ios-gray dark:text-gray-400">
                {accountTypes.find(t => t.value === formData.type)?.label}
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
            className="flex-1 py-3 px-4 rounded-ios bg-ios-blue hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Создание...' : 'Создать счет'}
          </button>
        </div>
      </form>
    </Modal>
  )
} 