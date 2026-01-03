/**
 * Утилиты для работы с датами и временем с учетом часового пояса пользователя
 */

/**
 * Форматирует дату с учетом часового пояса пользователя
 * @param dateString - ISO строка даты или объект Date
 * @param timezone - IANA timezone (например, 'Europe/Moscow')
 * @param options - Опции форматирования (как в Intl.DateTimeFormat)
 */
export function formatDate(
  dateString: string | Date,
  timezone: string = 'Europe/Moscow',
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }

  try {
    return new Intl.DateTimeFormat('ru-RU', {
      ...defaultOptions,
      timeZone: timezone,
    }).format(date)
  } catch (error) {
    // Fallback к локальному времени при ошибке
    console.warn(`Ошибка форматирования времени для timezone ${timezone}:`, error)
    return new Intl.DateTimeFormat('ru-RU', defaultOptions).format(date)
  }
}

/**
 * Форматирует дату для отображения (дата и время)
 */
export function formatDateTime(
  dateString: string | Date,
  timezone: string = 'Europe/Moscow'
): string {
  return formatDate(dateString, timezone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Форматирует только дату (без времени)
 */
export function formatDateOnly(
  dateString: string | Date,
  timezone: string = 'Europe/Moscow'
): string {
  return formatDate(dateString, timezone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * Форматирует только время (без даты)
 */
export function formatTimeOnly(
  dateString: string | Date,
  timezone: string = 'Europe/Moscow'
): string {
  return formatDate(dateString, timezone, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Форматирует относительное время (например, "5 минут назад")
 */
export function formatRelativeTime(
  dateString: string | Date,
  timezone: string = 'Europe/Moscow'
): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  const now = new Date()
  
  // Конвертируем в локальное время пользователя для сравнения
  const userDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
  const userNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  
  const diff = userNow.getTime() - userDate.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'минуту' : minutes < 5 ? 'минуты' : 'минут'} назад`
  }
  if (hours < 24) {
    return `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'} назад`
  }
  if (days < 7) {
    return `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'} назад`
  }
  
  return formatDateOnly(dateString, timezone)
}

