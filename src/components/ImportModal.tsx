import React, { useState } from 'react'
import { Modal } from './Modal'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onTransactionsImported: () => void
}

interface ParsedTransaction {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
}

const bankTemplates = [
  {
    id: 'sberbank',
    name: 'Сбербанк',
    columns: {
      date: 'Дата операции',
      description: 'Описание операции',
      amount: 'Сумма операции',
      currency: 'Валюта операции'
    }
  },
  {
    id: 'tinkoff',
    name: 'Тинькофф',
    columns: {
      date: 'Дата платежа',
      description: 'Описание',
      amount: 'Сумма платежа',
      currency: 'Валюта платежа'
    }
  },
  {
    id: 'alfabank',
    name: 'Альфа-Банк',
    columns: {
      date: 'Дата',
      description: 'Описание операции',
      amount: 'Сумма',
      currency: 'Валюта'
    }
  },
  {
    id: 'custom',
    name: 'Свой формат',
    columns: {
      date: '',
      description: '',
      amount: '',
      currency: ''
    }
  }
]

export function ImportModal({ isOpen, onClose, onTransactionsImported }: ImportModalProps) {
  const [file, setFile] = useState(null)
  const [selectedBank, setSelectedBank] = useState('sberbank')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [accounts, setAccounts] = useState([])
  const [preview, setPreview] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1) // 1: выбор файла, 2: настройка, 3: предпросмотр

  React.useEffect(() => {
    if (isOpen) {
      loadAccounts()
    }
  }, [isOpen])

  const loadAccounts = async () => {
    try {
      const res = await fetch('/api/accounts')
      const json = await res.json()
      const accountsData = Array.isArray(json?.data) ? json.data : []
      setAccounts(accountsData as any)
      if (accountsData.length > 0) {
        setSelectedAccount((accountsData as any)[0].id)
      }
    } catch (error) {
      console.error('Ошибка загрузки счетов:', error)
    }
  }

  const handleFileChange = (e: any) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError('')
    }
  }

  const parseFile = () => {
    if (!file) return

    setLoading(true)
    setError('')

    const fileExtension = (file as any).name.split('.').pop()?.toLowerCase()

    if (fileExtension === 'csv') {
      Papa.parse(file as any, {
        header: true,
        encoding: 'UTF-8',
        complete: (results: any) => {
          try {
            const transactions = parseTransactions(results.data as any[])
            setPreview(transactions as any)
            setStep(3)
          } catch (err) {
            setError('Ошибка парсинга CSV файла: ' + (err as Error).message)
          } finally {
            setLoading(false)
          }
        },
        error: (error: any) => {
          setError('Ошибка чтения CSV файла: ' + error.message)
          setLoading(false)
        }
      })
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader()
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array((e.target?.result as ArrayBuffer))
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet)
          
          const transactions = parseTransactions(jsonData as any[])
          setPreview(transactions as any)
          setStep(3)
        } catch (err) {
          setError('Ошибка парсинга Excel файла: ' + (err as Error).message)
        } finally {
          setLoading(false)
        }
      }
      reader.readAsArrayBuffer(file as any)
    } else {
      setError('Поддерживаются только файлы CSV и Excel (.xlsx, .xls)')
      setLoading(false)
    }
  }

  const parseTransactions = (data: any[]): ParsedTransaction[] => {
    const template = bankTemplates.find(t => t.id === selectedBank)
    if (!template) throw new Error('Шаблон банка не найден')

    return data.map((row: any, index: number) => {
      try {
        const dateStr = (row as any)[(template as any).columns.date]
        const description = (row as any)[(template as any).columns.description] || `Операция ${index + 1}`
        const amountStr = (row as any)[(template as any).columns.amount]

        if (!dateStr || !amountStr) {
          throw new Error(`Строка ${index + 1}: отсутствуют обязательные поля`)
        }

        // Парсим дату
        let date: string
        if (typeof dateStr === 'string') {
          // Пробуем разные форматы даты
          const dateFormats = [
            /(\d{2})\.(\d{2})\.(\d{4})/, // DD.MM.YYYY
            /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
            /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
          ]
          
          let parsedDate: Date | null = null
          for (const format of dateFormats) {
            const match = (dateStr as string).match(format)
            if (match) {
              if (format === dateFormats[0] || format === dateFormats[2]) {
                // DD.MM.YYYY или DD/MM/YYYY
                parsedDate = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]))
              } else {
                // YYYY-MM-DD
                parsedDate = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
              }
              break
            }
          }
          
          if (!parsedDate || isNaN(parsedDate.getTime())) {
            throw new Error(`Строка ${index + 1}: неверный формат даты`)
          }
          date = parsedDate.toISOString().split('T')[0]
        } else {
          date = new Date().toISOString().split('T')[0]
        }

        // Парсим сумму
        let amount: number
        if (typeof amountStr === 'number') {
          amount = amountStr
        } else {
          const cleanAmount = amountStr.toString()
            .replace(/[^\d,-]/g, '') // убираем все кроме цифр, запятых и минусов
            .replace(',', '.') // заменяем запятую на точку
          amount = parseFloat(cleanAmount)
          
          if (isNaN(amount)) {
            throw new Error(`Строка ${index + 1}: неверный формат суммы`)
          }
        }

        return {
          date,
          description: description.toString(),
          amount: Math.abs(amount),
          type: (amount >= 0 ? 'income' : 'expense') as 'income' | 'expense'
        }
      } catch (err) {
        throw new Error(`Ошибка в строке ${index + 1}: ${(err as Error).message}`)
      }
    }).filter((t: any) => t.amount > 0) // убираем пустые транзакции
  }

  const importTransactions = async () => {
    if (!selectedAccount || preview.length === 0) return

    setLoading(true)
    setError('')

    try {
      for (const transaction of preview as any[]) {
        const payload = {
          amount: (transaction as any).type === 'expense' ? -(transaction as any).amount : (transaction as any).amount,
          description: (transaction as any).description,
          type: (transaction as any).type,
          date: (transaction as any).date,
          accountId: selectedAccount as any,
          categoryId: null
        }
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error || 'Не удалось импортировать транзакцию')
        }
      }

      onTransactionsImported()
      onClose()
      resetForm()
    } catch (err) {
      setError('Ошибка импорта: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setPreview([] as any)
    setStep(1)
    setError('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Импорт выписки">
      <div className="space-y-6">
        {/* Step 1: Выбор файла */}
        {step === 1 && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Выберите банк
              </label>
              <select
                value={selectedBank}
                onChange={(e: any) => setSelectedBank(e.target.value)}
                className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue"
              >
                {bankTemplates.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Выберите счет для импорта
              </label>
              <select
                value={selectedAccount}
                onChange={(e: any) => setSelectedAccount(e.target.value)}
                className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue"
              >
                {(accounts as any[]).map((account: any) => (
                  <option key={account.id} value={account.id}>
                    {account.icon} {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Файл выписки (CSV или Excel)
              </label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue"
              />
              <p className="text-sm text-ios-gray dark:text-gray-400 mt-1">
                Поддерживаются файлы CSV и Excel (.xlsx, .xls)
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-3 px-4 rounded-ios border border-ios-gray5 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-ios-gray6 dark:hover:bg-gray-700 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={parseFile}
                disabled={!file || !selectedAccount || loading}
                className="flex-1 py-3 px-4 rounded-ios bg-ios-blue hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Обработка...' : 'Далее'}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Предпросмотр */}
        {step === 3 && (
          <>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                Предпросмотр ({(preview as any[]).length} транзакций)
              </h4>
              <div className="max-h-64 overflow-y-auto bg-ios-gray6 dark:bg-gray-700 rounded-ios p-4">
                {(preview as any[]).slice(0, 10).map((transaction: any, index: number) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-ios-gray5 dark:border-gray-600 last:border-b-0">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {transaction.description}
                      </div>
                      <div className="text-sm text-ios-gray dark:text-gray-400">
                        {new Date(transaction.date).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                    <div className={`font-bold ${transaction.type === 'income' ? 'text-ios-green' : 'text-ios-red'}`}>
                      {transaction.type === 'income' ? '+' : '-'}{transaction.amount.toLocaleString('ru-RU')} ₽
                    </div>
                  </div>
                ))}
                {(preview as any[]).length > 10 && (
                  <div className="text-center text-sm text-ios-gray dark:text-gray-400 mt-2">
                    ... и еще {(preview as any[]).length - 10} транзакций
                  </div>
                )}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 px-4 rounded-ios border border-ios-gray5 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-ios-gray6 dark:hover:bg-gray-700 transition-colors"
              >
                Назад
              </button>
              <button
                onClick={importTransactions}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-ios bg-ios-green hover:bg-green-600 text-white font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Импорт...' : 'Импортировать'}
              </button>
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-ios p-3">
            <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}
      </div>
    </Modal>
  )
} 