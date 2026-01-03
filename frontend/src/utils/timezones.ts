/**
 * Список популярных часовых поясов
 */
export const TIMEZONES = [
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Kiev', label: 'Киев (UTC+2)' },
  { value: 'Europe/Minsk', label: 'Минск (UTC+3)' },
  { value: 'Europe/Astana', label: 'Астана (UTC+6)' },
  { value: 'Asia/Almaty', label: 'Алматы (UTC+6)' },
  { value: 'Asia/Tashkent', label: 'Ташкент (UTC+5)' },
  { value: 'Asia/Baku', label: 'Баку (UTC+4)' },
  { value: 'Asia/Yerevan', label: 'Ереван (UTC+4)' },
  { value: 'Asia/Tbilisi', label: 'Тбилиси (UTC+4)' },
  { value: 'Europe/London', label: 'Лондон (UTC+0)' },
  { value: 'Europe/Paris', label: 'Париж (UTC+1)' },
  { value: 'Europe/Berlin', label: 'Берлин (UTC+1)' },
  { value: 'Europe/Rome', label: 'Рим (UTC+1)' },
  { value: 'Europe/Madrid', label: 'Мадрид (UTC+1)' },
  { value: 'America/New_York', label: 'Нью-Йорк (UTC-5)' },
  { value: 'America/Chicago', label: 'Чикаго (UTC-6)' },
  { value: 'America/Denver', label: 'Денвер (UTC-7)' },
  { value: 'America/Los_Angeles', label: 'Лос-Анджелес (UTC-8)' },
  { value: 'America/Toronto', label: 'Торонто (UTC-5)' },
  { value: 'Asia/Dubai', label: 'Дубай (UTC+4)' },
  { value: 'Asia/Shanghai', label: 'Шанхай (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Токио (UTC+9)' },
  { value: 'Asia/Seoul', label: 'Сеул (UTC+9)' },
  { value: 'Asia/Singapore', label: 'Сингапур (UTC+8)' },
  { value: 'Australia/Sydney', label: 'Сидней (UTC+10)' },
  { value: 'America/Sao_Paulo', label: 'Сан-Паулу (UTC-3)' },
  { value: 'America/Mexico_City', label: 'Мехико (UTC-6)' },
]

export function getTimezoneLabel(value: string): string {
  const timezone = TIMEZONES.find(tz => tz.value === value)
  return timezone?.label || value
}

