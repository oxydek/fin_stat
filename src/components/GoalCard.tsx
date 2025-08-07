import React from 'react'

interface Goal {
  id: string
  name: string
  description?: string
  targetAmount: number
  currentAmount: number
  targetDate?: Date
  icon?: string
  color?: string
  isCompleted: boolean
}

interface GoalCardProps {
  goal: Goal
  onClick?: () => void
}

export function GoalCard({ goal, onClick }: GoalCardProps) {
  const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0)
  
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date?: Date) => {
    if (!date) return null
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date)
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-ios-green'
    if (progress >= 75) return 'bg-ios-blue'
    if (progress >= 50) return 'bg-ios-orange'
    return 'bg-ios-red'
  }

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-ios shadow-ios hover:shadow-ios-card p-6 cursor-pointer transition-all duration-200 hover:scale-[1.02] border border-ios-gray5 dark:border-gray-700"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
            style={{ backgroundColor: goal.color || '#007AFF' }}
          >
            <span className="text-white">
              {goal.icon || '🎯'}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
              {goal.name}
            </h3>
            {goal.description && (
              <p className="text-sm text-ios-gray dark:text-gray-400">
                {goal.description}
              </p>
            )}
          </div>
        </div>
        
        {goal.isCompleted && (
          <div className="text-ios-green text-2xl">
            ✅
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatAmount(goal.currentAmount)} из {formatAmount(goal.targetAmount)}
          </span>
          <span className="text-sm font-bold text-ios-blue dark:text-blue-400">
            {Math.round(progress)}%
          </span>
        </div>
        
        <div className="w-full bg-ios-gray5 dark:bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${getProgressColor(progress)}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center text-sm">
        <div className="text-ios-gray dark:text-gray-400">
          {goal.isCompleted ? (
            <span className="text-ios-green font-medium">Цель достигнута! 🎉</span>
          ) : (
            <span>Осталось: {formatAmount(remaining)}</span>
          )}
        </div>
        
        {goal.targetDate && (
          <div className="text-ios-gray dark:text-gray-400">
            {formatDate(goal.targetDate)}
          </div>
        )}
      </div>
    </div>
  )
} 