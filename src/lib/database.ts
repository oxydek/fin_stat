// Browser-safe in-memory mock of a minimal Prisma-like client
// Provides only the methods actually used by UI components

// Types used by the mock
interface AccountRecord {
  id: string
  name: string
  type: string
  balance: number
  currency: string
  icon?: string
  color?: string
  isActive: boolean
}

interface GoalRecord {
  id: string
  name: string
  description?: string
  targetAmount: number
  currentAmount: number
  targetDate?: string | null
  icon?: string
  color?: string
  isCompleted: boolean
  isActive: boolean
}

interface CategoryRecord {
  id: string
  name: string
  type: 'income' | 'expense'
  isActive: boolean
}

interface ReminderRecord {
  id: string
  title: string
  message?: string
  type: string
  frequency: 'once' | 'daily' | 'weekly' | 'monthly'
  nextDate: string
  isActive: boolean
  goalId?: string | null
}

interface TransactionRecord {
  id: string
  amount: number
  description: string
  type: 'income' | 'expense'
  date: string
  accountId: string
  categoryId: string | null
}

// Storage helpers
const STORAGE_KEYS = {
  accounts: 'finstat_accounts',
  goals: 'finstat_goals',
  categories: 'finstat_categories',
  reminders: 'finstat_reminders',
  transactions: 'finstat_transactions'
} as const

type StorageKey = keyof typeof STORAGE_KEYS

function loadFromStorage<T>(key: StorageKey): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS[key])
    if (!raw) return []
    return JSON.parse(raw) as T[]
  } catch {
    return []
  }
}

function saveToStorage<T>(key: StorageKey, value: T[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value))
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Seed default categories once
function ensureDefaultCategories(): void {
  const categories = loadFromStorage<CategoryRecord>('categories')
  if (categories.length > 0) return

  const defaults: CategoryRecord[] = [
    { id: generateId(), name: 'Зарплата', type: 'income', isActive: true },
    { id: generateId(), name: 'Перевод', type: 'income', isActive: true },
    { id: generateId(), name: 'Еда', type: 'expense', isActive: true },
    { id: generateId(), name: 'Транспорт', type: 'expense', isActive: true },
    { id: generateId(), name: 'Покупки', type: 'expense', isActive: true }
  ]
  saveToStorage('categories', defaults)
}

ensureDefaultCategories()

// Minimal mock client
class MockPrismaClient {
  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}

  account = {
    findMany: async ({ where, select }: { where?: { isActive?: boolean }, select?: any } = {}) => {
      const rows = loadFromStorage<AccountRecord>('accounts')
      const filtered = where?.isActive ? rows.filter(a => a.isActive) : rows
      if (!select) return filtered
      return filtered.map(a => pick(a, select))
    },
    create: async ({ data }: { data: Omit<AccountRecord, 'id' | 'isActive'> }) => {
      const rows = loadFromStorage<AccountRecord>('accounts')
      const created: AccountRecord = { id: generateId(), isActive: true, ...data }
      rows.unshift(created)
      saveToStorage('accounts', rows)
      return created
    },
    update: async ({ where, data }: { where: { id: string }, data: { balance?: { increment?: number } } }) => {
      const rows = loadFromStorage<AccountRecord>('accounts')
      const idx = rows.findIndex(a => a.id === where.id)
      if (idx === -1) throw new Error('Account not found')
      if (data.balance?.increment) {
        rows[idx].balance += data.balance.increment
      }
      saveToStorage('accounts', rows)
      return rows[idx]
    }
  }

  goal = {
    findMany: async ({ where, orderBy, select }: { where?: { isActive?: boolean, isCompleted?: boolean }, orderBy?: any, select?: any } = {}) => {
      let rows = loadFromStorage<GoalRecord>('goals')
      if (where?.isActive) rows = rows.filter(g => g.isActive)
      if (typeof where?.isCompleted === 'boolean') rows = rows.filter(g => g.isCompleted === where!.isCompleted)
      // orderBy ignored for mock
      if (!select) return rows
      return rows.map(g => pick(g, select))
    },
    create: async ({ data }: { data: Partial<GoalRecord> & { name: string, targetAmount: number } }) => {
      const rows = loadFromStorage<GoalRecord>('goals')
      const created: GoalRecord = {
        id: generateId(),
        description: data.description || undefined,
        currentAmount: 0,
        targetDate: data.targetDate ? (data.targetDate as any as Date).toString() : null,
        icon: data.icon,
        color: data.color,
        isCompleted: false,
        isActive: true,
        name: data.name,
        targetAmount: data.targetAmount
      }
      rows.unshift(created)
      saveToStorage('goals', rows)
      return created
    }
  }

  reminder = {
    findMany: async ({ where, include }: { where?: { isActive?: boolean, nextDate?: { lte?: Date } }, include?: { goal?: { select: { name: boolean, icon: boolean } } } } = {}) => {
      let rows = loadFromStorage<ReminderRecord>('reminders')
      if (where?.isActive) rows = rows.filter(r => r.isActive)
      if (where?.nextDate?.lte) {
        const lte = where.nextDate.lte
        rows = rows.filter(r => new Date(r.nextDate) <= new Date(lte))
      }
      if (include?.goal) {
        const goals = loadFromStorage<GoalRecord>('goals')
        return rows.map(r => ({
          ...r,
          goal: r.goalId ? pick(goals.find(g => g.id === r.goalId) || {}, { name: true, icon: true }) : null
        }))
      }
      return rows
    },
    create: async ({ data }: { data: Omit<ReminderRecord, 'id' | 'isActive' | 'nextDate'> & { nextDate: Date } }) => {
      const rows = loadFromStorage<ReminderRecord>('reminders')
      const created: ReminderRecord = {
        id: generateId(),
        isActive: true,
        nextDate: (data.nextDate as Date).toString(),
        title: data.title,
        message: data.message,
        type: data.type,
        frequency: data.frequency as any,
        goalId: (data as any).goalId || null
      }
      rows.unshift(created)
      saveToStorage('reminders', rows)
      return created
    },
    update: async ({ where, data }: { where: { id: string }, data: Partial<Omit<ReminderRecord, 'id'>> & { nextDate?: Date } }) => {
      const rows = loadFromStorage<ReminderRecord>('reminders')
      const idx = rows.findIndex(r => r.id === where.id)
      if (idx === -1) throw new Error('Reminder not found')
      if (typeof data.isActive === 'boolean') rows[idx].isActive = data.isActive
      if (data.nextDate) rows[idx].nextDate = data.nextDate.toString()
      saveToStorage('reminders', rows)
      return rows[idx]
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const rows = loadFromStorage<ReminderRecord>('reminders')
      const idx = rows.findIndex(r => r.id === where.id)
      if (idx === -1) throw new Error('Reminder not found')
      const [removed] = rows.splice(idx, 1)
      saveToStorage('reminders', rows)
      return removed
    }
  }

  transaction = {
    create: async ({ data }: { data: Omit<TransactionRecord, 'id' | 'date'> & { date: Date } }) => {
      const rows = loadFromStorage<TransactionRecord>('transactions')
      const created: TransactionRecord = {
        id: generateId(),
        amount: data.amount,
        description: data.description,
        type: data.type,
        date: data.date.toString(),
        accountId: data.accountId,
        categoryId: data.categoryId ?? null
      }
      rows.push(created)
      saveToStorage('transactions', rows)
      return created
    }
  }

  category = {
    findMany: async ({ where }: { where?: { isActive?: boolean } } = {}) => {
      let rows = loadFromStorage<CategoryRecord>('categories')
      if (where?.isActive) rows = rows.filter(c => c.isActive)
      return rows
    }
  }
}

function pick<T extends object>(obj: T, select: Record<string, boolean>): Partial<T> {
  const result: Partial<T> = {}
  if (!obj) return result
  Object.keys(select || {}).forEach((key) => {
    if ((select as any)[key] && key in obj) {
      ;(result as any)[key] = (obj as any)[key]
    }
  })
  return result
}

// Export a singleton mock client for the browser
export const prisma = new MockPrismaClient() as any 