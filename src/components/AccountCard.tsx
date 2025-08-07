import React from 'react'

interface Account {
  id: string
  name: string
  type: string
  balance: number
  currency: string
  icon?: string
  color?: string
}

interface AccountCardProps {
  account: Account
  onClick?: () => void
}

export function AccountCard({ account, onClick }: AccountCardProps) {
  const formatBalance = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency === 'RUB' ? 'RUB' : 'USD',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getTypeDisplay = (type: string) => {
    const types: { [key: string]: string } = {
      card: 'Карта',
      cash: 'Наличные',
      deposit: 'Вклад',
      crypto: 'Криптовалюта'
    }
    return types[type] || type
  }

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-ios shadow-ios hover:shadow-ios-card p-6 cursor-pointer transition-all duration-200 hover:scale-[1.02] border border-ios-gray5 dark:border-gray-700"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
            style={{ backgroundColor: account.color || '#007AFF' }}
          >
            <span className="text-white">
              {account.icon || '💳'}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
              {account.name}
            </h3>
            <p className="text-sm text-ios-gray dark:text-gray-400">
              {getTypeDisplay(account.type)}
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatBalance(account.balance, account.currency)}
          </p>
          <p className="text-sm text-ios-gray dark:text-gray-400 mt-1">
            Баланс
          </p>
        </div>
        
        <div className="text-ios-blue dark:text-blue-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  )
} 