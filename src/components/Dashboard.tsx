import React, { useState, useEffect } from 'react'
import { AccountCard } from './AccountCard'
import { GoalCard } from './GoalCard'
import { AddAccountModal } from './AddAccountModal'
import { AddGoalModal } from './AddGoalModal'
import { ImportModal } from './ImportModal'
import { prisma } from '../lib/database'
import { seedDatabase } from '../lib/seed'

interface Account {
  id: string
  name: string
  type: string
  balance: number
  currency: string
  icon?: string
  color?: string
}

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

export function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Заполняем базу данных базовыми данными если она пустая
      await seedDatabase()
      
      // Загружаем счета
      const accountsData = await prisma.account.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      })
      
      // Загружаем цели
      const goalsData = await prisma.goal.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      })

      setAccounts(accountsData.map(account => ({
        ...account,
        icon: account.icon || undefined,
        color: account.color || undefined
      })))
      setGoals(goalsData.map(goal => ({
        ...goal,
        description: goal.description || undefined,
        icon: goal.icon || undefined,
        color: goal.color || undefined,
        targetDate: goal.targetDate ? new Date(goal.targetDate) : undefined
      })))
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0)
  const totalSavings = goals.reduce((sum, goal) => sum + goal.currentAmount, 0)
  const activeGoals = goals.filter(goal => !goal.isCompleted).length

  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ios-blue mx-auto mb-4"></div>
          <p className="text-ios-gray dark:text-gray-400">Загрузка данных...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Welcome Card */}
      <div className="bg-white dark:bg-gray-800 rounded-ios shadow-ios-card p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Добро пожаловать в FinStat
        </h2>
        <p className="text-ios-gray dark:text-gray-300">
          Ваш личный помощник для управления финансами и накоплениями
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-ios-blue to-ios-indigo rounded-ios p-6 text-white">
          <h3 className="text-lg font-medium mb-2">Общий баланс</h3>
          <p className="text-3xl font-bold">{formatBalance(totalBalance)}</p>
        </div>
        <div className="bg-gradient-to-br from-ios-green to-ios-teal rounded-ios p-6 text-white">
          <h3 className="text-lg font-medium mb-2">Накопления</h3>
          <p className="text-3xl font-bold">{formatBalance(totalSavings)}</p>
        </div>
        <div className="bg-gradient-to-br from-ios-orange to-ios-yellow rounded-ios p-6 text-white">
          <h3 className="text-lg font-medium mb-2">Активных целей</h3>
          <p className="text-3xl font-bold">{activeGoals}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <button 
          onClick={() => setShowAddAccount(true)}
          className="bg-white dark:bg-gray-800 rounded-ios shadow-ios p-6 text-left hover:shadow-ios-card transition-shadow"
        >
          <div className="text-2xl mb-2">💳</div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Счета</h3>
          <p className="text-sm text-ios-gray dark:text-gray-400">Добавить новый счет</p>
        </button>
        
        <button 
          onClick={() => setShowAddGoal(true)}
          className="bg-white dark:bg-gray-800 rounded-ios shadow-ios p-6 text-left hover:shadow-ios-card transition-shadow"
        >
          <div className="text-2xl mb-2">🎯</div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Цели</h3>
          <p className="text-sm text-ios-gray dark:text-gray-400">Создать новую цель</p>
        </button>
        
        <button className="bg-white dark:bg-gray-800 rounded-ios shadow-ios p-6 text-left hover:shadow-ios-card transition-shadow">
          <div className="text-2xl mb-2">📊</div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Статистика</h3>
          <p className="text-sm text-ios-gray dark:text-gray-400">Анализ трат</p>
        </button>
        
        <button 
          onClick={() => setShowImport(true)}
          className="bg-white dark:bg-gray-800 rounded-ios shadow-ios p-6 text-left hover:shadow-ios-card transition-shadow"
        >
          <div className="text-2xl mb-2">📄</div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Импорт</h3>
          <p className="text-sm text-ios-gray dark:text-gray-400">Загрузка выписок</p>
        </button>
      </div>

      {/* Accounts Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Мои счета
          </h3>
          <button 
            onClick={() => setShowAddAccount(true)}
            className="bg-ios-blue hover:bg-blue-600 text-white px-4 py-2 rounded-ios text-sm font-medium transition-colors"
          >
            Добавить счет
          </button>
        </div>
        
        {accounts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-ios shadow-ios p-8 text-center">
            <div className="text-4xl mb-4">💳</div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Пока нет счетов
            </h4>
            <p className="text-ios-gray dark:text-gray-400 mb-4">
              Добавьте первый счет для отслеживания финансов
            </p>
            <button 
              onClick={() => setShowAddAccount(true)}
              className="bg-ios-blue hover:bg-blue-600 text-white px-6 py-3 rounded-ios font-medium transition-colors"
            >
              Создать счет
            </button>
          </div>
        )}
      </div>

      {/* Goals Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Цели накоплений
          </h3>
          <button 
            onClick={() => setShowAddGoal(true)}
            className="bg-ios-green hover:bg-green-600 text-white px-4 py-2 rounded-ios text-sm font-medium transition-colors"
          >
            Добавить цель
          </button>
        </div>
        
        {goals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-ios shadow-ios p-8 text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Пока нет целей
            </h4>
            <p className="text-ios-gray dark:text-gray-400 mb-4">
              Создайте первую цель для накоплений
            </p>
            <button 
              onClick={() => setShowAddGoal(true)}
              className="bg-ios-green hover:bg-green-600 text-white px-6 py-3 rounded-ios font-medium transition-colors"
            >
              Создать цель
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddAccountModal
        isOpen={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onAccountAdded={loadData}
      />
      
      <AddGoalModal
        isOpen={showAddGoal}
        onClose={() => setShowAddGoal(false)}
        onGoalAdded={loadData}
      />

      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onTransactionsImported={loadData}
      />
    </div>
  )
} 