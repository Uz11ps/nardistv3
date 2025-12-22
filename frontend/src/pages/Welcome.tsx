import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function Welcome() {
  const navigate = useNavigate()
  const { user, login, loginAsGuest } = useAuthStore()

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'url(/img/App2.png) no-repeat center center fixed',
        backgroundSize: 'cover',
        backgroundColor: '#1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        textAlign: 'center',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(26, 26, 26, 0.7)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <div style={{ marginBottom: '40px', position: 'relative', zIndex: 1 }}>
        <h1
          style={{
            color: '#FFF',
            textAlign: 'center',
            fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '48px',
            fontStyle: 'normal',
            fontWeight: 1000,
            lineHeight: '22px',
            letterSpacing: '-0.4px',
            marginBottom: '16px',
          }}
        >
          НАРДИСТ
        </h1>
        <p
          style={{
            color: '#FFF',
            textAlign: 'center',
            fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '24px',
            fontStyle: 'normal',
            fontWeight: 274,
            lineHeight: 'normal',
            maxWidth: '400px',
            margin: 0,
          }}
        >
          Добро пожаловать в мир нард
        </p>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <button
          onClick={async () => {
            if (user) {
              navigate('/onboarding/profile')
              return
            }

            try {
              // Сначала пытаемся войти через Telegram
              await login()
              navigate('/onboarding/profile')
            } catch (error: any) {
              // Если Telegram не доступен, входим как гость
              if (error.code === 'NO_INIT_DATA') {
                try {
                  console.log('🌐 Telegram не доступен, выполняем гостевой вход...')
                  await loginAsGuest()
                  // Проверяем, создан ли мок-гость (isGuest)
                  const currentUser = useAuthStore.getState().user
                  if (currentUser?.isGuest) {
                    // Мок-гость создан, переходим на главную (онбординг пропускается)
                    console.log('✅ Мок-гость создан, переходим на главную страницу')
                    navigate('/')
                  } else {
                    // Обычный гость, проходим онбординг
                    navigate('/onboarding/profile')
                  }
                } catch (guestError: any) {
                  console.error('Ошибка гостевого входа:', guestError)
                  
                  // Если это ошибка сети и мы в режиме разработки, мок-гость уже создан
                  if (guestError.code === 'NETWORK_ERROR' && import.meta.env.DEV) {
                    const currentUser = useAuthStore.getState().user
                    if (currentUser?.isGuest) {
                      console.log('✅ Мок-гость создан несмотря на ошибку, переходим на главную')
                      navigate('/')
                      return
                    }
                  }
                  
                  let errorMessage = 'Не удалось войти как гость. '
                  if (guestError.code === 'NETWORK_ERROR') {
                    errorMessage += 'Сервер недоступен. Убедитесь что бэкенд запущен или проверьте подключение к интернету.'
                  } else if (guestError.code === 'SERVER_ERROR') {
                    errorMessage += 'Ошибка сервера. Попробуйте позже.'
                  } else {
                    errorMessage += guestError.message || 'Неизвестная ошибка'
                  }
                  
                  alert(errorMessage)
                }
              } else {
                // Другие ошибки авторизации
                console.error('Ошибка авторизации:', error)
                console.error('Детали ошибки:', {
                  message: error.message,
                  code: error.code,
                  response: error.response?.data,
                })
                
                let errorMessage = 'Ошибка авторизации. '
                if (error.response?.status === 401) {
                  errorMessage += error.response?.data?.message || 'Неверные данные авторизации'
                } else {
                  errorMessage += error.message || 'Неизвестная ошибка'
                }
                
                alert(errorMessage)
              }
            }
          }}
          style={{
            display: 'flex',
            width: '313px',
            height: '52px',
            minWidth: '50px',
            padding: '15px 12px',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            borderRadius: '12px',
            border: '0.1px solid #C93C3D',
            background: 'linear-gradient(180deg, #E84142 -144.23%, #681C1C 105.77%)',
            boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.25), 7px 2px 9.4px 0 rgba(0, 0, 0, 0.31) inset',
            color: '#FFF',
            fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '18px',
            fontWeight: 600,
            cursor: 'pointer',
            borderStyle: 'solid',
            outline: 'none',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)'
            e.currentTarget.style.boxShadow = '0 8px 20px 0 rgba(0, 0, 0, 0.35), 7px 2px 9.4px 0 rgba(0, 0, 0, 0.31) inset'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 6px 16px 0 rgba(0, 0, 0, 0.25), 7px 2px 9.4px 0 rgba(0, 0, 0, 0.31) inset'
          }}
        >
          Начать
        </button>
      </div>
    </div>
  )
}

