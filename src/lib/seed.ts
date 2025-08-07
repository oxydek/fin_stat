import { prisma } from './database'

export async function seedDatabase() {
  try {
    // Создаем категории по умолчанию
    const categories = [
      // Доходы
      { name: 'Зарплата', type: 'income', icon: '💰', color: '#34C759' },
      { name: 'Фриланс', type: 'income', icon: '💻', color: '#007AFF' },
      { name: 'Подарки', type: 'income', icon: '🎁', color: '#FF2D92' },
      { name: 'Инвестиции', type: 'income', icon: '📈', color: '#5AC8FA' },
      
      // Расходы
      { name: 'Продукты', type: 'expense', icon: '🛒', color: '#FF9500' },
      { name: 'Транспорт', type: 'expense', icon: '🚗', color: '#5856D6' },
      { name: 'Развлечения', type: 'expense', icon: '🎬', color: '#AF52DE' },
      { name: 'Здоровье', type: 'expense', icon: '🏥', color: '#FF3B30' },
      { name: 'Образование', type: 'expense', icon: '📚', color: '#34C759' },
      { name: 'Коммунальные', type: 'expense', icon: '🏠', color: '#8E8E93' },
      { name: 'Одежда', type: 'expense', icon: '👕', color: '#FF2D92' },
      { name: 'Кафе и рестораны', type: 'expense', icon: '🍕', color: '#FFCC00' },
    ]

    for (const category of categories) {
      await prisma.category.upsert({
        where: { name: category.name },
        update: {},
        create: category,
      })
    }

    // Создаем базовые настройки
    await prisma.settings.upsert({
      where: { id: 'settings' },
      update: {},
      create: {
        id: 'settings',
        currency: 'RUB',
        language: 'ru',
        theme: 'auto',
      },
    })

    console.log('✅ База данных заполнена базовыми данными')
  } catch (error) {
    console.error('❌ Ошибка при заполнении базы данных:', error)
  }
} 