import React, { useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { NotificationSystem } from './components/NotificationSystem'
import { ReminderModal } from './components/ReminderModal'
import { Modal } from './components/Modal'
import { prisma } from './lib/database'

function App() {
	const getInitialTheme = () => {
		try {
			const saved = localStorage.getItem('theme')
			if (saved === 'dark') return true
			if (saved === 'light') return false
		} catch {}
		if (typeof window !== 'undefined' && window.matchMedia) {
			return window.matchMedia('(prefers-color-scheme: dark)').matches
		}
		return false
	}

	const [isDark, setIsDark] = useState(getInitialTheme())
	const [showReminder, setShowReminder] = useState(false)

	// Reminders list modal
	const [showRemindersList, setShowRemindersList] = useState(false)
	const [reminders, setReminders] = useState([] as any[])
	const [remindersLoading, setRemindersLoading] = useState(false)

	// PWA install state
	const [deferredPrompt, setDeferredPrompt] = useState(null as any)
	const [canInstall, setCanInstall] = useState(false)

	// Web Push state
	const [canEnablePush, setCanEnablePush] = useState(false)

	// App Lock (biometrics + PIN)
	const [showLockSettings, setShowLockSettings] = useState(false)
	const [lockEnabled, setLockEnabled] = useState(() => {
		try { return localStorage.getItem('lockEnabled') === '1' } catch { return false }
	})
	const [isLocked, setIsLocked] = useState(() => {
		try { return localStorage.getItem('lockEnabled') === '1' } catch { return false }
	})
	const [pinInput, setPinInput] = useState('')
	const [pinNew, setPinNew] = useState('')
	const [pinConfirm, setPinConfirm] = useState('')
	const [webauthnAvailable, setWebauthnAvailable] = useState(false)

	const notify = (payload: any) => {
		try { const fn = (window as any).showNotification; if (typeof fn === 'function') fn(payload) } catch {}
	}

	const hashText = async (text: string) => {
		const enc = new TextEncoder().encode(text)
		const buf = await crypto.subtle.digest('SHA-256', enc)
		const arr = Array.from(new Uint8Array(buf))
		return arr.map(b => b.toString(16).padStart(2, '0')).join('')
	}

	const randomChallenge = (len = 32) => {
		const arr = new Uint8Array(len)
		crypto.getRandomValues(arr)
		return arr
	}

	const toBase64Url = (buf: ArrayBuffer) => {
		let str = ''
		const bytes = new Uint8Array(buf)
		for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i])
		return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
	}

	const fromBase64Url = (b64: string) => {
		const pad = '='.repeat((4 - (b64.length % 4)) % 4)
		const base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/')
		const raw = atob(base64)
		const out = new Uint8Array(raw.length)
		for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
		return out.buffer
	}

	const checkWebAuthnAvailability = async () => {
		try {
			const ok = (window as any).PublicKeyCredential && await (window as any).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
			setWebauthnAvailable(!!ok)
		} catch { setWebauthnAvailable(false) }
	}

	const registerWebAuthn = async () => {
		try {
			await checkWebAuthnAvailability()
			if (!webauthnAvailable) {
				notify({ title: 'Биометрия недоступна', type: 'warning' })
				return
			}
			const userId = randomChallenge(16)
			const cred: any = await (navigator as any).credentials.create({
				publicKey: {
					challenge: randomChallenge(32),
					rp: { name: 'FinStat' },
					user: { id: userId, name: 'user@finstat', displayName: 'FinStat User' },
					pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
					authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
					timeout: 60000
				}
			})
			const id = cred?.id || (cred?.rawId ? toBase64Url(cred.rawId) : '')
			if (!id) throw new Error('Не удалось зарегистрировать биометрию')
			localStorage.setItem('webauthnId', id)
			notify({ title: 'Face/Touch ID настроен', type: 'success' })
		} catch (e:any) {
			notify({ title: 'Ошибка биометрии', message: e?.message || String(e), type: 'error' })
		}
	}

	const authWebAuthn = async () => {
		try {
			const id = localStorage.getItem('webauthnId')
			if (!id) return false
			const cred = await (navigator as any).credentials.get({
				publicKey: { challenge: randomChallenge(32), timeout: 60000, allowCredentials: [{ id: fromBase64Url(id), type: 'public-key' }], userVerification: 'required' }
			})
			return !!cred
		} catch { return false }
	}

	const lockNow = () => {
		setIsLocked(true)
	}

	const unlockWithBiometrics = async () => {
		const ok = await authWebAuthn()
		if (ok) setIsLocked(false)
		else notify({ title: 'Не удалось распознать', type: 'warning' })
	}

	const unlockWithPin = async () => {
		try {
			const hash = await hashText(pinInput)
			const saved = localStorage.getItem('lockPinHash') || ''
			if (hash === saved && saved) {
				setIsLocked(false)
				setPinInput('')
			} else {
				notify({ title: 'Неверный PIN', type: 'error' })
			}
		} catch {}
	}

	const saveSettings = async () => {
		try {
			localStorage.setItem('lockEnabled', lockEnabled ? '1' : '0')
			if (pinNew) {
				if (pinNew.length < 4 || pinNew !== pinConfirm) {
					notify({ title: 'PIN должен совпадать и быть 4+ символа', type: 'warning' })
					return
				}
				const h = await hashText(pinNew)
				localStorage.setItem('lockPinHash', h)
				setPinNew(''); setPinConfirm('')
			}
			notify({ title: 'Настройки сохранены', type: 'success' })
			setShowLockSettings(false)
			if (lockEnabled) setIsLocked(true)
		} catch {}
	}

	React.useEffect(() => {
		checkWebAuthnAvailability()
		const onVis = () => {
			try {
				if (document.visibilityState === 'visible') {
					if (localStorage.getItem('lockEnabled') === '1') setIsLocked(true)
				}
			} catch {}
		}
		document.addEventListener('visibilitychange', onVis)
		return () => document.removeEventListener('visibilitychange', onVis)
	}, [])

	React.useEffect(() => {
		try {
			localStorage.setItem('theme', isDark ? 'dark' : 'light')
		} catch {}
		try {
			const root = document.documentElement
			if (isDark) root.classList.add('dark')
			else root.classList.remove('dark')
		} catch {}
	}, [isDark])

	React.useEffect(() => {
		const handler = (e: any) => {
			e.preventDefault()
			setDeferredPrompt(e)
			setCanInstall(true)
		}
		window.addEventListener('beforeinstallprompt', handler as any)
		return () => window.removeEventListener('beforeinstallprompt', handler as any)
	}, [])

	React.useEffect(() => {
		// Показать кнопку включения пушей, если поддерживается
		(async () => {
			try {
				const hasSW = 'serviceWorker' in navigator
				const hasPush = 'PushManager' in window
				if (hasSW && hasPush) setCanEnablePush(Notification.permission !== 'granted')
			} catch {}
		})()
	}, [])

	const onClickInstall = async () => {
		try {
			const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
			const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (window.navigator as any).standalone
			if (isIOS && !isStandalone) {
				notify({ title: 'Установка на iPhone', message: 'Нажмите Поделиться → Добавить на экран “Домой”', type: 'info', autoClose: false })
				return
			}
			if (!deferredPrompt) return
			deferredPrompt.prompt()
			const { outcome } = await deferredPrompt.userChoice
			setDeferredPrompt(null)
			setCanInstall(false)
			notify({ title: outcome === 'accepted' ? 'Приложение установлено' : 'Установка отменена', type: outcome === 'accepted' ? 'success' : 'warning' })
		} catch (e:any) {
			notify({ title: 'Ошибка установки', message: e?.message || String(e), type: 'error' })
		}
	}

	const urlBase64ToUint8Array = (base64String: string) => {
		const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
		const rawData = window.atob(base64)
		const outputArray = new Uint8Array(rawData.length)
		for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
		return outputArray
	}

	const registerPush = async () => {
		try {
			if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
				notify({ title: 'Пуши не поддерживаются', type: 'warning' })
				return
			}
			const reg = await navigator.serviceWorker.ready
			const r = await fetch('/api/push/public-key')
			const j = await r.json()
			const publicKey = j?.data || ''
			if (!publicKey) throw new Error('Публичный ключ не настроен на сервере')
			const perm = await Notification.requestPermission()
			if (perm !== 'granted') return
			const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
			await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) })
			setCanEnablePush(false)
			notify({ title: 'Пуш‑уведомления включены', type: 'success' })
		} catch (e:any) {
			notify({ title: 'Не удалось включить пуши', message: e?.message || String(e), type: 'error' })
		}
	}

	const loadReminders = async () => {
		setRemindersLoading(true)
		try {
			const list = await prisma.reminder.findMany({})
			setReminders(Array.isArray(list) ? list : [])
		} catch {
			setReminders([])
		} finally {
			setRemindersLoading(false)
		}
	}

	const toggleReminder = async (id: string, isActive: boolean) => {
		try {
			await prisma.reminder.update({ where: { id }, data: { isActive } })
			await loadReminders()
		} catch {}
	}

	const deleteReminder = async (id: string) => {
		try {
			await prisma.reminder.delete({ where: { id } })
			await loadReminders()
		} catch {}
	}

	const openReminders = async () => {
		await loadReminders()
		setShowRemindersList(true)
	}

	const reloadData = () => {
		// Функция для перезагрузки данных после создания напоминания
		window.location.reload()
	}

	return (
		<NotificationSystem>
			<div className={`min-h-screen ${isDark ? 'dark' : ''}`}>
				<div className="min-h-screen bg-ios-gray6 dark:bg-gray-900 font-sf">
					{/* Header */}
					<header className="bg-white dark:bg-gray-800 shadow-ios border-b border-ios-gray5 dark:border-gray-700">
						<div className="px-6 py-4 flex justify-between items-center">
							<h1 className="text-2xl font-bold text-gray-900 dark:text-white">
								FinStat
							</h1>
							
							<div className="flex items-center space-x-3">
								{canInstall && (
									<button
										onClick={onClickInstall}
										className="p-2 rounded-ios bg-ios-blue text-white hover:bg-blue-600 transition-colors"
										title="Установить приложение"
									>
										⬇️
									</button>
								)}
								{canEnablePush && (
									<button
										onClick={registerPush}
										className="p-2 rounded-ios bg-ios-green text-white hover:bg-green-600 transition-colors"
										title="Включить уведомления"
									>
										🔔
									</button>
								)}
								<button
									onClick={() => setShowReminder(true)}
									className="p-2 rounded-ios bg-ios-purple text-white hover:bg-purple-600 transition-colors"
									title="Создать напоминание"
								>
									⏰
								</button>
								<button
									onClick={openReminders}
									className="p-2 rounded-ios bg-ios-gray5 dark:bg-gray-700 text-ios-blue dark:text-white hover:bg-ios-gray4 dark:hover:bg-gray-600 transition-colors"
									title="Мои напоминания"
								>
									📋
								</button>
								<button
									onClick={() => setShowLockSettings(true)}
									className="p-2 rounded-ios bg-ios-gray5 dark:bg-gray-700 text-ios-blue dark:text-white hover:bg-ios-gray4 dark:hover:bg-gray-600 transition-colors"
									title="Блокировка"
								>
									🔒
								</button>
								
								<button
									onClick={() => setIsDark(!isDark)}
									className="p-2 rounded-ios bg-ios-gray5 dark:bg-gray-700 text-ios-blue dark:text-white hover:bg-ios-gray4 dark:hover:bg-gray-600 transition-colors"
								>
									{isDark ? '☀️' : '🌙'}
								</button>
							</div>
						</div>
					</header>

					{/* Main Content */}
					<main className="p-6">
						<Dashboard />
						{/* iOS hint inline on mobile if not installable */}
						<div className="mt-4 sm:hidden text-xs text-ios-gray dark:text-gray-400">
							Для установки на iPhone: Поделиться → Добавить на экран «Домой»
						</div>
					</main>
				</div>
			</div>

			{/* Reminder Modal */}
			<ReminderModal
				isOpen={showReminder}
				onClose={() => setShowReminder(false)}
				onReminderAdded={reloadData}
			/>

			{/* Reminders List Modal */}
			<Modal
				isOpen={showRemindersList}
				onClose={() => setShowRemindersList(false)}
				title="Мои напоминания"
			>
				<div className="space-y-4">
					{remindersLoading ? (
						<div className="text-sm text-ios-gray dark:text-gray-400">Загрузка...</div>
					) : reminders.length === 0 ? (
						<div className="text-sm text-ios-gray dark:text-gray-400">Пока нет напоминаний</div>
					) : (
						<div className="divide-y divide-ios-gray5 dark:divide-gray-700">
							{reminders.map((r:any) => (
								<div key={r.id} className="py-3 flex items-center justify-between">
									<div className="min-w-0 pr-3">
										<div className="font-medium text-gray-900 dark:text-white truncate">{r.title}</div>
										{r.message && (
											<div className="text-xs text-ios-gray dark:text-gray-400 truncate">{r.message}</div>
										)}
										<div className="text-xs text-ios-gray dark:text-gray-400 mt-1">
											{new Date(r.nextDate).toLocaleString('ru-RU')} • {r.frequency}
										</div>
									</div>
									<div className="flex items-center gap-2">
										<button onClick={() => toggleReminder(r.id, !r.isActive)} className={`px-3 py-1 rounded-ios text-sm ${r.isActive ? 'bg-ios-gray5 dark:bg-gray-700' : 'bg-ios-green text-white'}`}>
											{r.isActive ? 'Выключить' : 'Включить'}
										</button>
										<button onClick={() => deleteReminder(r.id)} className="px-3 py-1 rounded-ios text-sm bg-ios-red text-white">Удалить</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</Modal>

			{/* Lock Settings */}
			<Modal
				isOpen={showLockSettings}
				onClose={() => setShowLockSettings(false)}
				title="Блокировка приложения"
			>
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="text-sm text-gray-900 dark:text-white">Включить блокировку</div>
						<button onClick={() => setLockEnabled(!lockEnabled)} className={`px-3 py-1 rounded-ios text-sm ${lockEnabled ? 'bg-ios-green text-white' : 'bg-ios-gray5 dark:bg-gray-700'}`}>{lockEnabled ? 'Вкл' : 'Выкл'}</button>
					</div>
					<div className="space-y-2">
						<div className="text-sm text-gray-900 dark:text-white">PIN‑код (резервный)</div>
						<input type="password" value={pinNew} onChange={(e: any)=>setPinNew((e.target as any).value)} placeholder="Новый PIN" className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700" />
						<input type="password" value={pinConfirm} onChange={(e: any)=>setPinConfirm((e.target as any).value)} placeholder="Подтверждение PIN" className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700" />
					</div>
					<div className="space-y-2">
						<div className="text-sm text-gray-900 dark:text-white">Face/Touch ID</div>
						<button onClick={registerWebAuthn} className="px-4 py-2 rounded-ios bg-ios-blue text-white">Настроить</button>
					</div>
					<div className="flex gap-2">
						<button onClick={saveSettings} className="px-4 py-2 rounded-ios bg-ios-green text-white">Сохранить</button>
						{lockEnabled && (<button onClick={lockNow} className="px-4 py-2 rounded-ios bg-ios-purple text-white">Заблокировать сейчас</button>)}
					</div>
				</div>
			</Modal>

			{/* Lock Screen Overlay */}
			{isLocked && (
				<div className="fixed inset-0 z-[60] bg-black bg-opacity-90 backdrop-blur-md flex items-center justify-center p-6">
					<div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-ios p-6 border border-ios-gray5 dark:border-gray-700 text-center">
						<div className="text-3xl mb-2">🔒</div>
						<div className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Приложение заблокировано</div>
						<div className="flex flex-col gap-3">
							<button onClick={unlockWithBiometrics} className="px-4 py-2 rounded-ios bg-ios-blue text-white">Разблокировать Face/Touch ID</button>
							<input type="password" placeholder="PIN" value={pinInput} onChange={(e: any)=>setPinInput((e.target as any).value)} className="w-full p-3 rounded-ios border border-ios-gray5 dark:border-gray-600 bg-white dark:bg-gray-700" />
							<button onClick={unlockWithPin} className="px-4 py-2 rounded-ios bg-ios-green text-white">Разблокировать PIN</button>
						</div>
					</div>
				</div>
			)}
		</NotificationSystem>
	)
}

export default App 