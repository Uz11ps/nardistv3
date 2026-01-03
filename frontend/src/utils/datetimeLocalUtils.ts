/**
 * Утилиты для работы с datetime-local input
 * datetime-local работает в локальном времени браузера
 */

/**
 * Конвертирует ISO строку (UTC) в формат для datetime-local input
 * datetime-local ожидает формат YYYY-MM-DDTHH:mm в локальном времени браузера
 */
export function utcToLocalDateTime(utcIsoString: string): string {
  if (!utcIsoString) return ''
  const date = new Date(utcIsoString)
  // Получаем локальные компоненты даты
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Конвертирует значение из datetime-local input в ISO строку (UTC)
 * datetime-local возвращает значение в локальном времени браузера
 */
export function localDateTimeToUtc(localDateTimeString: string): string {
  if (!localDateTimeString) return ''
  // datetime-local возвращает значение в локальном времени
  // Создаем Date объект, который автоматически интерпретирует это как локальное время
  const localDate = new Date(localDateTimeString)
  // toISOString() конвертирует в UTC
  return localDate.toISOString()
}

