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
  // datetime-local возвращает значение в формате YYYY-MM-DDTHH:mm в локальном времени
  // Явно создаем Date объект в локальном времени, используя компоненты
  const [datePart, timePart] = localDateTimeString.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)
  
  // Создаем Date объект в локальном времени (индексы месяца начинаются с 0)
  const localDate = new Date(year, month - 1, day, hours, minutes)
  // toISOString() конвертирует в UTC
  return localDate.toISOString()
}

