import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import { PrismaClient } from '@prisma/client'

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

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`[api] listening on :${PORT}`)
}) 