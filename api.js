import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import { PrismaClient } from '@prisma/client'
// Add Tinkoff Invest API client
let TinkoffInvestApi
try {
  // dynamic import to avoid crash if package not installed in some environments
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  TinkoffInvestApi = (await import('tinkoff-invest-api')).TinkoffInvestApi
} catch (e) {
  TinkoffInvestApi = null
}

const app = express()
const prisma = new PrismaClient()

app.use(cors())
app.use(bodyParser.json())

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// Token management
app.get('/api/token', async (_req, res) => {
  try {
    const s = await prisma.settings.upsert({
      where: { id: 'settings' },
      update: {},
      create: { id: 'settings' }
    })
    res.json({ ok: true, data: s.tinkoffToken || '' })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})
app.post('/api/token', async (req, res) => {
  try {
    const token = String(req.body?.token || '')
    const s = await prisma.settings.upsert({
      where: { id: 'settings' },
      update: { tinkoffToken: token },
      create: { id: 'settings', tinkoffToken: token }
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

// Accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true'
    const accounts = await prisma.account.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ ok: true, data: accounts })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

app.post('/api/accounts', async (req, res) => {
  try {
    const { name, type, balance = 0, currency = 'RUB', icon, color } = req.body || {}
    if (!name || !type) return res.status(400).json({ ok: false, error: 'name and type are required' })
    const created = await prisma.account.create({ data: { name, type, balance, currency, icon, color } })
    res.json({ ok: true, data: created })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

app.patch('/api/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body || {}
    const updated = await prisma.account.update({ where: { id }, data })
    res.json({ ok: true, data: updated })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

// Transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const { accountId } = req.query
    const where = accountId ? { accountId: String(accountId) } : {}
    const txs = await prisma.transaction.findMany({ where, orderBy: { date: 'desc' } })
    res.json({ ok: true, data: txs })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

app.post('/api/transactions', async (req, res) => {
  try {
    const { amount, description, type, date, accountId, categoryId } = req.body || {}
    if (typeof amount !== 'number' || !type || !accountId) {
      return res.status(400).json({ ok: false, error: 'amount(number), type and accountId are required' })
    }
    const created = await prisma.transaction.create({
      data: { amount, description, type, date: date ? new Date(date) : new Date(), accountId, categoryId: categoryId || null }
    })
    // adjust account balance
    await prisma.account.update({ where: { id: accountId }, data: { balance: { increment: amount } } })
    res.json({ ok: true, data: created })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

// Goals
app.get('/api/goals', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true'
    const goals = await prisma.goal.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ ok: true, data: goals })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

app.post('/api/goals', async (req, res) => {
  try {
    const { name, targetAmount, description, targetDate, icon, color } = req.body || {}
    if (!name || typeof targetAmount !== 'number') {
      return res.status(400).json({ ok: false, error: 'name and targetAmount(number) are required' })
    }
    const created = await prisma.goal.create({
      data: { name, targetAmount, description, targetDate: targetDate ? new Date(targetDate) : null, icon, color }
    })
    res.json({ ok: true, data: created })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

// Update goal (close, edit, etc.)
app.patch('/api/goals/:id', async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body || {}
    const updated = await prisma.goal.update({ where: { id }, data })
    res.json({ ok: true, data: updated })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

app.post('/api/goals/:id/contributions', async (req, res) => {
  try {
    const { id } = req.params
    const { amount, fromAccountId } = req.body || {}
    if (typeof amount !== 'number' || !fromAccountId) {
      return res.status(400).json({ ok: false, error: 'amount(number) and fromAccountId are required' })
    }
    // create expense transaction on account
    await prisma.transaction.create({
      data: { amount: -Math.abs(amount), description: `Взнос в цель`, type: 'expense', accountId: fromAccountId }
    })
    await prisma.account.update({ where: { id: fromAccountId }, data: { balance: { increment: -Math.abs(amount) } } })
    // increase goal currentAmount
    const updated = await prisma.goal.update({
      where: { id },
      data: { currentAmount: { increment: Math.abs(amount) } }
    })
    res.json({ ok: true, data: updated })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

// --- Broker sync (T‑Invest) ---
async function syncBrokerAccounts() {
  try {
    // read token
    const settings = await prisma.settings.findUnique({ where: { id: 'settings' } })
    const token = settings?.tinkoffToken || ''
    if (!token) return { ok: false, reason: 'NO_TOKEN' }
    if (!TinkoffInvestApi) return { ok: false, reason: 'LIB_NOT_INSTALLED' }

    const api = new TinkoffInvestApi({ token })

    // get accounts
    const accountsResp = await api.users.getAccounts({})
    const accounts = accountsResp?.accounts || []

    const results = []
    for (const acc of accounts) {
      const accountId = acc.id || acc.accountId || acc.brokerAccountId || acc.brokerAccountId_
      // get cash positions
      let rubCash = 0
      try {
        const pos = await api.operations.getPositions({ accountId })
        const moneyArr = Array.isArray(pos?.money) ? pos.money : (Array.isArray(pos?.money?.money) ? pos.money.money : [])
        for (const mv of moneyArr) {
          const ccy = String(mv?.currency || mv?.value?.currency || mv?.money?.currency || 'rub').toLowerCase()
          const units = Number((mv.units ?? mv.value?.units) ?? 0)
          const nano = Number((mv.nano ?? mv.value?.nano) ?? 0)
          const val = units + nano / 1_000_000_000
          if (ccy === 'rub' || ccy === 'rur') rubCash += val
        }
      } catch {}

      const externalId = `tinkoff-invest:${accountId}`
      const name = `T‑Invest • ${acc?.name || acc?.brokerAccountType || 'Счет'}`

      const upserted = await prisma.account.upsert({
        where: { externalId },
        update: {
          name,
          type: 'broker',
          currency: 'RUB',
          icon: '📈',
          color: '#0ea5e9',
          isActive: true,
          balance: Math.round(rubCash)
        },
        create: {
          name,
          type: 'broker',
          currency: 'RUB',
          icon: '📈',
          color: '#0ea5e9',
          isActive: true,
          balance: Math.round(rubCash),
          externalSource: 'tinkoff-invest',
          externalId
        }
      })
      results.push(upserted)
    }

    return { ok: true, data: results }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

app.post('/api/sync/broker', async (_req, res) => {
  const r = await syncBrokerAccounts()
  if (!r.ok) return res.status(500).json(r)
  res.json(r)
})

// background periodic sync (every 5 minutes)
setInterval(async () => {
  try { await syncBrokerAccounts() } catch {}
}, 5 * 60 * 1000)

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`[api] listening on :${PORT}`)
}) 