import React, { useState, useEffect } from 'react'
import { AccountCard } from './AccountCard'
import { GoalCard } from './GoalCard'
import { AddAccountModal } from './AddAccountModal'
import { AddGoalModal } from './AddGoalModal'
import { ImportModal } from './ImportModal'
import { prisma } from '../lib/database'
import { Modal } from './Modal'

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

interface TransactionItem {
  id: string
  amount: number
  description: string
  type: 'income' | 'expense'
  date: string
  accountId: string
  categoryId?: string | null
}

export function Dashboard() {
  const [accounts, setAccounts] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const [selectedAccount, setSelectedAccount] = useState(null)
  const [showAccountDetails, setShowAccountDetails] = useState(false)
  const [accountTransactions, setAccountTransactions] = useState([])

  // Forms
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [newRate, setNewRate] = useState('')

  // Goal details state
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [showGoalDetails, setShowGoalDetails] = useState(false)
  const [contributionAmount, setContributionAmount] = useState('')
  const [contributionAccountId, setContributionAccountId] = useState('')
  const [closingGoalId, setClosingGoalId] = useState('')

  // Statistics
  const [showStats, setShowStats] = useState(false)
  const [stats, setStats] = useState({
    months: [] as any[],
    incomeByMonth: [] as any[],
    expenseByMonth: [] as any[],
    topCategories: [] as any[],
    totals: { income: 0, expense: 0, net: 0 }
  })

  // Broker accounts
  const [showBroker, setShowBroker] = useState(false)
  const [brokerAccounts, setBrokerAccounts] = useState([])
  const [brokerError, setBrokerError] = useState('')
  const [brokerCash, setBrokerCash] = useState({} as Record<string, number>)
  const [showToken, setShowToken] = useState(false)
  const [tokenValue, setTokenValue] = useState('')
  const [selectedBrokerId, setSelectedBrokerId] = useState('')
  const [portfolio, setPortfolio] = useState(null)
  const [positions, setPositions] = useState(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [accruedInterest, setAccruedInterest] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (showAccountDetails && selectedAccount) {
      loadAccountTransactions(selectedAccount.id)
      // проставим текущую ставку и посчитаем проценты (с сервера)
      ;(async () => {
        const r = await getCurrentRate(selectedAccount.id)
        setNewRate(r != null ? String(r) : '')
        const ai = await computeAccruedInterest(selectedAccount.id)
        setAccruedInterest(ai)
      })()
    }
  }, [showAccountDetails, selectedAccount])

  useEffect(() => {
    if (showStats) computeStats()
  }, [showStats])

  // ===== API helpers (server) =====
  const apiGetAccount = async (accountId: string): Promise<any | null> => {
    try {
      const res = await fetch('/api/accounts?includeInactive=true')
      const json = await res.json()
      const list = Array.isArray(json?.data) ? json.data : []
      return list.find((a: any) => a.id === accountId) || null
    } catch {
      return null
    }
  }
  const apiPatchAccount = async (accountId: string, data: any): Promise<void> => {
    await fetch(`/api/accounts/${accountId}` , {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
  }

  const loadData = async () => {
    try {
      // Загружаем реальные данные из (мока) prisma
      const accountsData = await prisma.account.findMany({
        where: { isActive: true }
      })
      
      const goalsData = await prisma.goal.findMany({
        where: { isActive: true }
      })

      setAccounts(
        (accountsData || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balance: a.balance,
          currency: a.currency,
          icon: a.icon || undefined,
          color: a.color || undefined,
        }))
      )

      setGoals(
        (goalsData || []).map((g: any) => ({
          id: g.id,
          name: g.name,
          description: g.description || undefined,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount ?? 0,
          targetDate: g.targetDate ? new Date(g.targetDate) : undefined,
          icon: g.icon || undefined,
          color: g.color || undefined,
          isCompleted: !!g.isCompleted,
        }))
      )
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAccountTransactions = (accountId: string) => {
    try {
      const raw = localStorage.getItem('finstat_transactions')
      const list = raw ? JSON.parse(raw) : []
      const filtered = list
        .filter((t: any) => t.accountId === accountId)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setAccountTransactions(filtered)
    } catch (e) {
      console.error('Ошибка чтения истории операций:', e)
      setAccountTransactions([])
    }
  }

  // ===== Interest helpers (rate buckets by account) =====
  type RateBucket = { rate: number; principal: number; startDate: string; lastSync?: string }
  const getBuckets = async (accountId: string): Promise<RateBucket[]> => {
    const row = await apiGetAccount(accountId)
    const buckets = (row?.rateBuckets || []) as RateBucket[]
    return Array.isArray(buckets) ? buckets : []
  }

  const setBuckets = async (accountId: string, buckets: RateBucket[]) => {
    await apiPatchAccount(accountId, { rateBuckets: buckets })
  }

  const getCurrentRate = async (accountId: string): Promise<number | null> => {
    const row = await apiGetAccount(accountId)
    return row && typeof row.interestRate === 'number' ? row.interestRate : null
  }

  const setCurrentRate = async (accountId: string, rate: number) => {
    const buckets = await getBuckets(accountId)
    buckets.push({ rate, principal: 0, startDate: new Date().toISOString(), lastSync: new Date().toISOString() })
    await apiPatchAccount(accountId, { interestRate: rate, rateBuckets: buckets })
  }

  const allocateToBucketsOnDeposit = async (accountId: string, amount: number) => {
    const rate = await getCurrentRate(accountId)
    if (rate == null) return
    const buckets = await getBuckets(accountId)
    if (buckets.length === 0 || buckets[buckets.length - 1].rate !== rate) {
      buckets.push({ rate, principal: 0, startDate: new Date().toISOString(), lastSync: new Date().toISOString() })
    }
    buckets[buckets.length - 1].principal += amount
    await setBuckets(accountId, buckets)
  }

  const deallocateOnWithdraw = async (accountId: string, amount: number) => {
    let rest = amount
    const buckets = await getBuckets(accountId)
    // снимаем из последних корзин сначала
    for (let i = buckets.length - 1; i >= 0 && rest > 0; i--) {
      const take = Math.min(buckets[i].principal, rest)
      buckets[i].principal -= take
      rest -= take
    }
    const filtered = buckets.filter((b, idx) => b.principal > 0 || idx === buckets.length - 1)
    await setBuckets(accountId, filtered)
  }

  const computeAccruedInterest = async (accountId: string): Promise<number> => {
    const buckets = await getBuckets(accountId)
    const today = new Date()
    let total = 0
    for (const b of buckets) {
      const from = b.lastSync ? new Date(b.lastSync) : new Date(b.startDate)
      const days = Math.max(0, Math.floor((today.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)))
      if (days > 0 && b.principal > 0 && b.rate > 0) {
        total += b.principal * (b.rate / 100) * (days / 365)
      }
    }
    return Math.floor(total)
  }

  const syncBucketsAfterInterest = async (accountId: string) => {
    const buckets = await getBuckets(accountId)
    const now = new Date().toISOString()
    for (const b of buckets) {
      b.lastSync = now
    }
    await setBuckets(accountId, buckets)
  }

  // ===== Actions =====
  const handleCloseAccount = () => {
    if (!selectedAccount) return
    // локально скрываем, серверная деактивация счетов не обязательна для UI
    setShowCloseConfirm(false)
    setShowAccountDetails(false)
    loadData()
  }

  const handleDeposit = async () => {
    if (!selectedAccount) return
    const amount = parseFloat(depositAmount)
    if (!amount || amount <= 0) return

    await prisma.transaction.create({
      data: {
        amount: amount,
        description: 'Пополнение',
        type: 'income',
        date: new Date(),
        accountId: selectedAccount.id,
        categoryId: null
      }
    })
    await prisma.account.update({
      where: { id: selectedAccount.id },
      data: { balance: { increment: amount } }
    })

    if (selectedAccount.type === 'deposit') {
      await allocateToBucketsOnDeposit(selectedAccount.id, amount)
      const ai = await computeAccruedInterest(selectedAccount.id)
      setAccruedInterest(ai)
    }

    setDepositAmount('')
    loadData()
    loadAccountTransactions(selectedAccount.id)
  }

  const handleWithdraw = async () => {
    if (!selectedAccount) return
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount <= 0) return

    await prisma.transaction.create({
      data: {
        amount: -amount,
        description: 'Списание',
        type: 'expense',
        date: new Date(),
        accountId: selectedAccount.id,
        categoryId: null
      }
    })
    await prisma.account.update({
      where: { id: selectedAccount.id },
      data: { balance: { increment: -amount } }
    })

    if (selectedAccount.type === 'deposit') {
      await deallocateOnWithdraw(selectedAccount.id, amount)
      const ai = await computeAccruedInterest(selectedAccount.id)
      setAccruedInterest(ai)
    }

    setWithdrawAmount('')
    loadData()
    loadAccountTransactions(selectedAccount.id)
  }

  const handleSaveRate = () => {
    if (!selectedAccount) return
    const rate = parseFloat(newRate)
    if (isNaN(rate) || rate < 0) return
    ;(async () => {
      await setCurrentRate(selectedAccount.id, rate)
      const ai = await computeAccruedInterest(selectedAccount.id)
      setAccruedInterest(ai)
    })()
  }

  const handleApplyInterest = async () => {
    if (!selectedAccount) return
    const interest = await computeAccruedInterest(selectedAccount.id)
    if (interest <= 0) return

    await prisma.transaction.create({
      data: {
        amount: interest,
        description: 'Начисленные проценты',
        type: 'income',
        date: new Date(),
        accountId: selectedAccount.id,
        categoryId: null
      }
    })
    await prisma.account.update({
      where: { id: selectedAccount.id },
      data: { balance: { increment: interest } }
    })

    await syncBucketsAfterInterest(selectedAccount.id)
    const ai = await computeAccruedInterest(selectedAccount.id)
    setAccruedInterest(ai)
    loadData()
    loadAccountTransactions(selectedAccount.id)
  }

  const totalBalance = (accounts as any[]).reduce((sum: number, account: any) => sum + account.balance, 0)
  const totalSavings = (goals as any[]).reduce((sum: number, goal: any) => sum + goal.currentAmount, 0)
  const activeGoals = (goals as any[]).filter((goal: any) => !goal.isCompleted).length

  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (value: string) => {
    return new Date(value).toLocaleString('ru-RU')
  }

  // ===== Broker helpers (cash only) =====
  const moneyValueToNumber = (m: any): number => {
    if (!m) return 0
    const units = Number((m.units ?? m.value?.units) ?? 0)
    const nano = Number((m.nano ?? m.value?.nano) ?? 0)
    return units + nano / 1_000_000_000
  }

  const loadBrokerCash = async (list: any[]) => {
    try {
      const entries = await Promise.all((list || []).map(async (acc: any) => {
        const id = acc.id || acc.accountId
        try {
          // @ts-ignore
          const res = await window.electronAPI?.getPositions?.(id)
          if (res?.ok && res.data?.money) {
            const moneyArr = Array.isArray(res.data.money) ? res.data.money : []
            // Берем только RUB
            const rubSum = moneyArr
              .filter((mv: any) => String(mv.currency || mv?.value?.currency || 'RUB').toUpperCase() === 'RUB')
              .reduce((sum: number, mv: any) => sum + moneyValueToNumber(mv), 0)
            return [id, rubSum] as [string, number]
          }
        } catch {}
        return [id, 0] as [string, number]
      }))
      const map: Record<string, number> = {}
      entries.forEach(([id, val]) => { map[id] = val })
      setBrokerCash(map)
    } catch {}
  }

  // ===== Statistics helpers =====
  const readTransactions = () => {
    const raw = localStorage.getItem('finstat_transactions')
    return raw ? JSON.parse(raw) : []
  }

  const monthLabel = (d: Date) => d.toLocaleString('ru-RU', { month: 'short', year: '2-digit' })

  const computeStats = () => {
    const txs = readTransactions()
    const now = new Date()
    const months: any[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: monthLabel(d), year: d.getFullYear(), month: d.getMonth() })
    }

    const incomeByMonth: any[] = new Array(6).fill(0)
    const expenseByMonth: any[] = new Array(6).fill(0)

    txs.forEach((t: any) => {
      const d = new Date(t.date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const idx = months.findIndex(m => m.key === key)
      if (idx !== -1) {
        if (t.type === 'income') incomeByMonth[idx] += Math.abs(t.amount)
        else expenseByMonth[idx] += Math.abs(t.amount)
      }
    })

    // Категории за 30 дней
    const since = new Date()
    since.setDate(since.getDate() - 30)
    const catMap: Record<string, number> = {}
    const categories = (localStorage.getItem('finstat_categories') ? JSON.parse(localStorage.getItem('finstat_categories') as any) : []) as any[]
    const catName = (id: string | null) => categories.find(c => c.id === id)?.name || 'Без категории'
    txs.forEach((t: any) => {
      const d = new Date(t.date)
      if (d >= since) {
        const key = (t.type === 'expense' ? 'Расход: ' : 'Доход: ') + catName(t.categoryId || null)
        catMap[key] = (catMap[key] || 0) + Math.abs(t.amount)
      }
    })
    const top = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }))

    const totals = {
      income: incomeByMonth.reduce((a, b) => a + b, 0),
      expense: expenseByMonth.reduce((a, b) => a + b, 0),
      net: incomeByMonth.reduce((a, b) => a + b, 0) - expenseByMonth.reduce((a, b) => a + b, 0)
    }

    setStats({ months, incomeByMonth, expenseByMonth, topCategories: top, totals })
  }

  // ===== Goals helpers =====
  const readGoalsStore = () => {
    const raw = localStorage.getItem('finstat_goals')
    return raw ? JSON.parse(raw) : []
  }
  const writeGoalsStore = (rows: any[]) => {
    localStorage.setItem('finstat_goals', JSON.stringify(rows))
  }

  const updateGoalInStore = (goalId: string, patch: (g: any) => void) => {
    const rows = readGoalsStore()
    const idx = rows.findIndex((g: any) => g.id === goalId)
    if (idx === -1) return
    const cloned = { ...rows[idx] }
    patch(cloned)
    rows[idx] = cloned
    writeGoalsStore(rows)
  }

  const handleContributeToGoal = async () => {
    if (!selectedGoal) return
    const amt = parseFloat(contributionAmount)
    if (!amt || amt <= 0) return
    if (!contributionAccountId) return

    // Списываем со счета
    await prisma.transaction.create({
      data: {
        amount: -amt,
        description: `Взнос в цель: ${selectedGoal.name}`,
        type: 'expense',
        date: new Date(),
        accountId: contributionAccountId,
        categoryId: null
      }
    })
    await prisma.account.update({
      where: { id: contributionAccountId },
      data: { balance: { increment: -amt } }
    })

    // Увеличиваем текущую сумму цели
    updateGoalInStore(selectedGoal.id, (g: any) => {
      const next = (g.currentAmount || 0) + amt
      g.currentAmount = next
      if (g.targetAmount && next >= g.targetAmount) {
        g.isCompleted = true
      }
    })

    setContributionAmount('')
    setContributionAccountId('')
    setShowGoalDetails(false)
    loadData()
  }

  const handleCloseGoal = () => {
    if (!selectedGoal) return
    const goalId = selectedGoal.id
    setClosingGoalId(goalId)
    setTimeout(() => {
      updateGoalInStore(goalId, (g: any) => {
        g.isActive = false
      })
      setShowGoalDetails(false)
      loadData()
      setClosingGoalId('')
    }, 300)
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
        
        <button onClick={() => setShowStats(true)} className="bg-white dark:bg-gray-800 rounded-ios shadow-ios p-6 text-left hover:shadow-ios-card transition-shadow">
          <div className="text-2xl mb-2">📊</div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Статистика</h3>
          <p className="text-sm text-ios-gray dark:text-gray-400">Анализ трат</p>
        </button>
        
        <button onClick={() => setShowImport(true)} className="bg-white dark:bg-gray-800 rounded-ios shadow-ios p-6 text-left hover:shadow-ios-card transition-shadow">
          <div className="text-2xl mb-2">📄</div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Импорт</h3>
          <p className="text-sm text-ios-gray dark:text-gray-400">Загрузка выписок</p>
        </button>

        <button onClick={async () => {
          try {
            setBrokerError('')
            // @ts-ignore
            const res = await window.electronAPI?.getBrokerAccounts?.()
            if (!res || !res.ok) {
              setBrokerError(res?.error || 'Не удалось получить данные')
              setBrokerAccounts([])
            } else {
              setBrokerAccounts(res.data || [])
              await loadBrokerCash(res.data || [])
            }
            setShowBroker(true)
          } catch (e:any) {
            setBrokerError(e?.message || String(e))
            setBrokerAccounts([])
            setShowBroker(true)
          }
        }} className="bg-white dark:bg-gray-800 rounded-ios shadow-ios p-6 text-left hover:shadow-ios-card transition-shadow">
          <div className="text-2xl mb-2">📈</div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Брокерские</h3>
          <p className="text-sm text-ios-gray dark:text-gray-400">Счета T‑Invest</p>
        </button>

        <button onClick={async () => {
          try {
            const r = await fetch('/api/token')
            const j = await r.json()
            if (j?.ok) setTokenValue(j.data || '')
          } catch {}
          setShowToken(true)
        }} className="bg-white dark:bg-gray-800 rounded-ios shadow-ios p-6 text-left hover:shadow-ios-card transition-shadow">
          <div className="text-2xl mb-2">🔑</div>
          <h3 className="font-semibold text-gray-900 dark:text-white">T‑Invest токен</h3>
          <p className="text-sm text-ios-gray dark:text-gray-400">Настроить .env</p>
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
            {(accounts as any[]).map((account) => (
              <div key={account.id}>
                <AccountCard
                  account={account}
                  onClick={() => {
                    setSelectedAccount(account)
                    setShowAccountDetails(true)
                  }}
                />
              </div>
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
            {(goals as any[]).map((goal) => (
              <div
                key={goal.id}
                className={`transition-all duration-300 ${closingGoalId === goal.id ? 'opacity-0 scale-95' : ''}`}
              >
                <GoalCard
                  goal={goal}
                  onClick={() => {
                    setSelectedGoal(goal)
                    setShowGoalDetails(true)
                  }}
                />
              </div>
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

      {/* Account Details Modal */}
      <Modal
        isOpen={showAccountDetails && !!selectedAccount}
        onClose={() => setShowAccountDetails(false)}
        title={selectedAccount ? `Счет: ${selectedAccount.name}` : 'Счет'}
      >
        {selectedAccount && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style={{ backgroundColor: selectedAccount.color || '#007AFF' }}
                >
                  <span className="text-white leading-none">{selectedAccount.icon || '💳'}</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{selectedAccount.name}</div>
                  <div className="text-sm text-ios-gray dark:text-gray-400">Баланс: {formatBalance(selectedAccount.balance)}</div>
                </div>
              </div>
            </div>

            {/* Actions: Deposit / Withdraw */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-ios-gray6 dark:bg-gray-700 rounded-ios p-4">
                <div className="font-medium mb-2">Пополнить</div>
                <div className="space-y-2">
                  <input
                    type="number"
                    placeholder="Сумма"
                    value={depositAmount}
                    onChange={(e: any) => setDepositAmount(e.target.value)}
                    className="w-full p-2 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-800"
                  />
                  <button onClick={handleDeposit} className="w-full py-2 rounded-ios bg-ios-green text-white hover:bg-green-600">Зачислить</button>
                </div>
              </div>

              <div className="bg-ios-gray6 dark:bg-gray-700 rounded-ios p-4">
                <div className="font-medium mb-2">Списать</div>
                <div className="space-y-2">
                  <input
                    type="number"
                    placeholder="Сумма"
                    value={withdrawAmount}
                    onChange={(e: any) => setWithdrawAmount(e.target.value)}
                    className="w-full p-2 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-800"
                  />
                  <button onClick={handleWithdraw} className="w-full py-2 rounded-ios bg-ios-red text-white hover:bg-red-600">Списать</button>
                </div>
              </div>
            </div>

            {/* Deposit settings */}
            {selectedAccount.type === 'deposit' && (
              <div className="bg-white dark:bg-gray-800 rounded-ios p-4 border border-ios-gray5 dark:border-gray-700">
                <div className="font-medium mb-3">Ставка по вкладу (годовых)</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-sm mb-1 text-ios-gray dark:text-gray-400">Текущая ставка, %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newRate}
                      onChange={(e: any) => setNewRate(e.target.value)}
                      className="w-full p-2 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-800"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-3">
                    <button onClick={handleSaveRate} className="px-4 py-2 rounded-ios bg-ios-blue text-white hover:bg-blue-600">Сохранить ставку</button>
                    <div className="text-sm text-ios-gray dark:text-gray-400">
                      Исторические вклады сохраняются по прежним ставкам
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-ios-gray dark:text-gray-400">
                    Начисленные проценты к выплате: <span className="font-semibold text-gray-900 dark:text-white">{accruedInterest.toLocaleString('ru-RU')} ₽</span>
                  </div>
                  <button onClick={handleApplyInterest} className="px-4 py-2 rounded-ios bg-ios-purple text-white hover:bg-purple-600">Начислить проценты</button>
                </div>
              </div>
            )}

            {/* Danger zone: Close account */}
            <div className="bg-white dark:bg-gray-800 rounded-ios p-4 border border-red-200 dark:border-red-700">
              <div className="flex items-center justify-between">
                <div className="font-medium text-red-600 dark:text-red-300">Опасная зона</div>
                {!showCloseConfirm ? (
                  <button onClick={() => setShowCloseConfirm(true)} className="px-4 py-2 rounded-ios bg-ios-red text-white hover:bg-red-600">Закрыть счет</button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-ios-gray dark:text-gray-400">Вы уверены?</span>
                    <button onClick={handleCloseAccount} className="px-3 py-2 rounded-ios bg-ios-red text-white">Да, закрыть</button>
                    <button onClick={() => setShowCloseConfirm(false)} className="px-3 py-2 rounded-ios bg-ios-gray5 dark:bg-gray-700">Отмена</button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">История операций</h4>
              {accountTransactions.length > 0 ? (
                <div className="divide-y divide-ios-gray5 dark:divide-gray-700">
                  {accountTransactions.map((tx: any) => (
                    <div key={tx.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{tx.description}</div>
                        <div className="text-xs text-ios-gray dark:text-gray-400">{formatDate(tx.date)}</div>
                      </div>
                      <div className={`${tx.type === 'income' ? 'text-ios-green' : 'text-ios-red'} font-bold`}>
                        {tx.type === 'income' ? '+' : '−'}{Math.abs(tx.amount).toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-ios-gray dark:text-gray-400">Пока нет операций</div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Goal Details Modal */}
      <Modal
        isOpen={showGoalDetails && !!selectedGoal}
        onClose={() => setShowGoalDetails(false)}
        title={selectedGoal ? `Цель: ${selectedGoal.name}` : 'Цель'}
      >
        {selectedGoal && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style={{ backgroundColor: selectedGoal.color || '#007AFF' }}
                >
                  <span className="text-white leading-none">{selectedGoal.icon || '🎯'}</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{selectedGoal.name}</div>
                  <div className="text-sm text-ios-gray dark:text-gray-400">
                    Прогресс: {(selectedGoal.currentAmount || 0).toLocaleString('ru-RU')} ₽ из {selectedGoal.targetAmount?.toLocaleString('ru-RU')} ₽
                  </div>
                </div>
              </div>
            </div>

            {/* Contribution */}
            <div className="bg-ios-gray6 dark:bg-gray-700 rounded-ios p-4">
              <div className="font-medium mb-2">Отложить на цель</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-sm mb-1 text-ios-gray dark:text-gray-400">Сумма</label>
                  <input
                    type="number"
                    placeholder="Сумма"
                    value={contributionAmount}
                    onChange={(e: any) => setContributionAmount(e.target.value)}
                    className="w-full p-2 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-ios-gray dark:text-gray-400">Со счета</label>
                  <select
                    value={contributionAccountId}
                    onChange={(e: any) => setContributionAccountId(e.target.value)}
                    className="w-full p-2 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-800"
                  >
                    <option value="">Выберите счет</option>
                    {(accounts as any[]).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.icon} {a.name} — {formatBalance(a.balance)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleContributeToGoal} className="flex-1 py-2 rounded-ios bg-ios-green text-white hover:bg-green-600">Отложить</button>
                  <button onClick={handleCloseGoal} className="px-4 py-2 rounded-ios bg-ios-red text-white hover:bg-red-600">Закрыть цель</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Statistics Modal */}
      <Modal
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        title="Статистика"
      >
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-ios-green to-ios-teal rounded-ios p-4 text-white">
              <div className="text-sm opacity-80">Доходы (6 мес)</div>
              <div className="text-2xl font-bold">{stats.totals.income.toLocaleString('ru-RU')} ₽</div>
            </div>
            <div className="bg-gradient-to-br from-ios-red to-pink-600 rounded-ios p-4 text-white">
              <div className="text-sm opacity-80">Расходы (6 мес)</div>
              <div className="text-2xl font-bold">{stats.totals.expense.toLocaleString('ru-RU')} ₽</div>
            </div>
            <div className="bg-gradient-to-br from-ios-blue to-ios-indigo rounded-ios p-4 text-white">
              <div className="text-sm opacity-80">Итог</div>
              <div className="text-2xl font-bold">{stats.totals.net.toLocaleString('ru-RU')} ₽</div>
            </div>
          </div>

          {/* Monthly bars */}
          <div className="bg-white dark:bg-gray-800 rounded-ios p-4 border border-ios-gray5 dark:border-gray-700">
            <div className="font-medium mb-3">Доходы и расходы по месяцам</div>
            <div className="space-y-3">
              {stats.months.map((m: any, idx: number) => {
                const max = Math.max(...stats.incomeByMonth, ...stats.expenseByMonth, 1)
                const incomePct = Math.round((stats.incomeByMonth[idx] / max) * 100)
                const expensePct = Math.round((stats.expenseByMonth[idx] / max) * 100)
                return (
                  <div key={m.key}>
                    <div className="flex justify-between text-xs text-ios-gray dark:text-gray-400 mb-1">
                      <span>{m.label}</span>
                      <span>
                        +{stats.incomeByMonth[idx].toLocaleString('ru-RU')} / -{stats.expenseByMonth[idx].toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                    <div className="w-full bg-ios-gray6 dark:bg-gray-700 rounded-full h-3">
                      <div className="h-3 rounded-full bg-ios-green" style={{ width: `${incomePct}%` }} />
                    </div>
                    <div className="w-full bg-ios-gray6 dark:bg-gray-700 rounded-full h-3 mt-1">
                      <div className="h-3 rounded-full bg-ios-red" style={{ width: `${expensePct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top categories */}
          <div className="bg-white dark:bg-gray-800 rounded-ios p-4 border border-ios-gray5 dark:border-gray-700">
            <div className="font-medium mb-3">Топ категорий за 30 дней</div>
            <div className="space-y-2">
              {stats.topCategories.length > 0 ? (
                stats.topCategories.map((c: any) => {
                  const max = Math.max(...stats.topCategories.map((x: any) => x.value), 1)
                  const pct = Math.round((c.value / max) * 100)
                  return (
                    <div key={c.name}>
                      <div className="flex justify-between text-xs text-ios-gray dark:text-gray-400">
                        <span>{c.name}</span>
                        <span>{c.value.toLocaleString('ru-RU')} ₽</span>
                      </div>
                      <div className="w-full bg-ios-gray6 dark:bg-gray-700 rounded-full h-2">
                        <div className="h-2 rounded-full bg-ios-blue" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-sm text-ios-gray dark:text-gray-400">Недостаточно данных</div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Broker Accounts Modal */}
      <Modal
        isOpen={showBroker}
        onClose={() => setShowBroker(false)}
        title="Брокерские счета (T‑Invest)"
      >
        <div className="space-y-4">
          {brokerError && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-ios p-3 text-red-700 dark:text-red-200 text-sm">
              {brokerError}
            </div>
          )}
          {(!brokerError && brokerAccounts.length === 0) && (
            <div className="text-sm text-ios-gray dark:text-gray-400">
              Нет данных. Убедитесь, что установлен переменный окружения <span className="font-mono">TINKOFF_TOKEN</span> и перезапущено приложение.
            </div>
          )}
          {brokerAccounts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(brokerAccounts as any[]).map((acc:any) => (
                <div key={acc.id || acc.accountId} className="bg-white dark:bg-gray-800 rounded-ios p-4 border border-ios-gray5 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">{acc.name || acc.brokerAccountType || 'Счет'}</div>
                      <div className="text-xs text-ios-gray dark:text-gray-400">ID: {acc.id || acc.accountId}</div>
                    </div>
                    <div className="text-xl">📈</div>
                  </div>
                  <div className="mt-2 text-sm text-gray-900 dark:text-white">
                    Денег: {formatBalance(Math.round(brokerCash[(acc.id || acc.accountId) as string] || 0))}
                  </div>
                  {acc.status && (
                    <div className="mt-2 text-xs text-ios-gray dark:text-gray-400">Статус: {acc.status}</div>
                  )}
                  {acc.openedDate && (
                    <div className="mt-1 text-xs text-ios-gray dark:text-gray-400">Открыт: {new Date(acc.openedDate).toLocaleDateString('ru-RU')}</div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button className="px-3 py-2 rounded-ios bg-ios-blue text-white text-sm" onClick={async () => {
                      setSelectedBrokerId(acc.id || acc.accountId)
                      // @ts-ignore
                      const p = await window.electronAPI?.getPortfolio?.(acc.id || acc.accountId)
                      setPortfolio(p?.ok ? p.data : { error: p?.error })
                      // @ts-ignore
                      const pos = await window.electronAPI?.getPositions?.(acc.id || acc.accountId)
                      setPositions(pos?.ok ? pos.data : { error: pos?.error })
                      // обновим кэш денег после ручной загрузки
                      await loadBrokerCash([acc])
                    }}>Портфель</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="text-xs text-ios-gray dark:text-gray-400">
            Интеграция через T‑Invest API. Подробнее см. документацию Т‑Банк: [Начало работы](https://developer.tbank.ru/invest/intro/intro).
          </div>

          {(portfolio || positions) && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-ios p-4 border border-ios-gray5 dark:border-gray-700">
                <div className="font-medium mb-2">Портфель — {selectedBrokerId}</div>
                {portfolio?.error ? (
                  <div className="text-sm text-red-500">{portfolio.error}</div>
                ) : (
                  <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(portfolio, null, 2)}</pre>
                )}
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-ios p-4 border border-ios-gray5 dark:border-gray-700">
                <div className="font-medium mb-2">Позиции — {selectedBrokerId}</div>
                {positions?.error ? (
                  <div className="text-sm text-red-500">{positions.error}</div>
                ) : (
                  <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(positions, null, 2)}</pre>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Token Settings Modal */}
      <Modal
        isOpen={showToken}
        onClose={() => setShowToken(false)}
        title="Настройка T‑Invest токена (.env)"
      >
        <div className="space-y-3">
          <input
            type="password"
            placeholder="TINKOFF_TOKEN"
            value={tokenValue}
            onChange={(e: any) => setTokenValue(e.target.value)}
            className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-800"
          />
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-ios bg-ios-blue text-white" onClick={async () => {
              try {
                const r = await fetch('/api/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenValue }) })
                const j = await r.json()
                if (j?.ok) setShowToken(false)
              } catch {}
            }}>Сохранить</button>
            <button className="px-4 py-2 rounded-ios bg-ios-gray5 dark:bg-gray-700" onClick={() => setShowToken(false)}>Отмена</button>
          </div>
          <div className="text-xs text-ios-gray dark:text-gray-400">
            Токен пишется в `.env` рядом с исполняемым файлом и в process.env текущего процесса; для гарантированного подхвата токена перезапустите приложение.
          </div>
        </div>
      </Modal>
    </div>
  )
} 