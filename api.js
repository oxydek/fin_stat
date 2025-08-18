import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import { PrismaClient } from '@prisma/client'
import webPush from 'web-push'

const app = express()
const prisma = new PrismaClient()

app.use(cors())
app.use(bodyParser.json())

// VAPID setup for Web Push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webPush.setVapidDetails('mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  } catch (e) {
    console.warn('[push] VAPID init failed:', e)
  }
}

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
    await prisma.settings.upsert({
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

// ===== Reminders REST =====
app.get('/api/reminders', async (_req, res) => {
  try {
    const rows = await prisma.reminder.findMany({ orderBy: { nextDate: 'asc' } })
    res.json({ ok: true, data: rows })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})
app.patch('/api/reminders/:id', async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body || {}
    const updated = await prisma.reminder.update({ where: { id }, data })
    res.json({ ok: true, data: updated })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})
app.delete('/api/reminders/:id', async (req, res) => {
  try {
    const { id } = req.params
    await prisma.reminder.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

// ===== Web Push =====
app.get('/api/push/public-key', (_req, res) => {
  res.json({ ok: true, data: VAPID_PUBLIC_KEY || '' })
})

app.post('/api/push/subscribe', async (req, res) => {
  try {
    const sub = req.body || {}
    const endpoint = String(sub?.endpoint || '')
    const p256dh = String(sub?.keys?.p256dh || '')
    const auth = String(sub?.keys?.auth || '')
    if (!endpoint || !p256dh || !auth) return res.status(400).json({ ok: false, error: 'Invalid subscription' })
    await prisma.webPushSubscription.upsert({
      where: { endpoint },
      update: { p256dh, auth },
      create: { endpoint, p256dh, auth }
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

app.post('/api/push/test', async (_req, res) => {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(400).json({ ok: false, error: 'VAPID not configured' })
    const subs = await prisma.webPushSubscription.findMany({})
    let sent = 0, removed = 0
    for (const s of subs) {
      const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }
      try {
        await webPush.sendNotification(subscription, JSON.stringify({ title: 'FinStat', body: 'Тестовое Web Push уведомление' }))
        sent++
      } catch (err) {
        const status = err?.statusCode
        if (status === 404 || status === 410) {
          removed++
          await prisma.webPushSubscription.delete({ where: { endpoint: s.endpoint } }).catch(() => {})
        }
      }
    }
    res.json({ ok: true, data: { sent, removed } })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

// ===== Broker API (T‑Invest via OpenAPI v1) =====
async function getTinkoffToken() {
  const s = await prisma.settings.findUnique({ where: { id: 'settings' } })
  const token = (s?.tinkoffToken || '').trim()
  if (!token) throw new Error('TINKOFF_TOKEN is not set')
  return token
}

// V1 helper (legacy)
async function tiFetch(pathWithQuery) {
  const token = await getTinkoffToken()
  const url = `https://api-invest.tinkoff.ru/openapi${pathWithQuery}`
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`T-Invest API v1 error ${r.status}: ${text || r.statusText}`)
  }
  const j = await r.json().catch(() => ({}))
  return j?.payload ?? j
}

// V2 helper (preferred REST gateway)
async function tiFetchV2(methodPath, body = {}) {
  const token = await getTinkoffToken()
  const url = `https://invest-public-api.tinkoff.ru/rest/${methodPath}`
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body || {})
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`T-Invest API v2 error ${r.status}: ${text || r.statusText}`)
  }
  return r.json().catch(() => ({}))
}

// Список брокерских счетов (v2 с fallback на v1)
app.get('/api/broker/accounts', async (_req, res) => {
  try {
    try {
      const j = await tiFetchV2('tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts', {})
      const accounts = Array.isArray(j?.accounts) ? j.accounts : []
      if (accounts.length > 0) return res.json({ ok: true, data: accounts })
      // если пусто, попробуем v1
    } catch (e) {
      // игнорируем и попробуем v1
    }
    const payload = await tiFetch('/user/accounts')
    const accountsV1 = Array.isArray(payload?.accounts) ? payload.accounts : []
    res.json({ ok: true, data: accountsV1 })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

// Портфель по счету (v2)
app.get('/api/broker/portfolio', async (req, res) => {
  try {
    const accountId = String(req.query.accountId || '')
    if (!accountId) return res.status(400).json({ ok: false, error: 'accountId is required' })
    const j = await tiFetchV2('tinkoff.public.invest.api.contract.v1.OperationsService/GetPortfolio', { accountId })
    res.json({ ok: true, data: j })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

// Денежные позиции (v2)
app.get('/api/broker/positions', async (req, res) => {
  try {
    const accountId = String(req.query.accountId || '')
    if (!accountId) return res.status(400).json({ ok: false, error: 'accountId is required' })
    const j = await tiFetchV2('tinkoff.public.invest.api.contract.v1.OperationsService/GetPositions', { accountId })
    // Вернем money как есть; фронтенд агрегирует RUB
    res.json({ ok: true, data: { money: j?.money ?? [] } })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`[api] listening on :${PORT}`)
}) 