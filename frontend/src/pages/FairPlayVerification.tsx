import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { apiClient } from '../api/client'
import './FairPlayVerification.css'

interface VerificationData {
  p1Rolls: number[][]
  p2Rolls: number[][]
  verificationSalt: string
  rngHash: string
  p1Offset: number
  p2Offset: number
  gameId: string
}

export default function FairPlayVerification() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [data, setData] = useState<VerificationData | null>(null)
  const [verificationResult, setVerificationResult] = useState<{
    p1Valid: boolean
    p2Valid: boolean
    p1Hash: string
    p2Hash: string
    originalP1Hash: string
    originalP2Hash: string
  } | null>(null)

  useEffect(() => {
    loadGameData()
  }, [gameId])

  const loadGameData = async () => {
    if (!gameId) return
    
    try {
      setLoading(true)
      const response = await apiClient.get(`/games/${gameId}`)
      const game = response.data
      
      if (!game.p1Rolls || !game.p2Rolls || !game.verificationSalt || !game.rngHash) {
        alert('Недостаточно данных для проверки. Игра должна быть завершена.')
        navigate(-1)
        return
      }

      setData({
        p1Rolls: game.p1Rolls,
        p2Rolls: game.p2Rolls,
        verificationSalt: game.verificationSalt,
        rngHash: game.rngHash,
        p1Offset: game.p1Offset || 1,
        p2Offset: game.p2Offset || 1,
        gameId: game.id,
      })
    } catch (error: any) {
      console.error('Ошибка загрузки данных игры:', error)
      alert('Ошибка загрузки данных игры')
      navigate(-1)
    } finally {
      setLoading(false)
    }
  }

  const calculateHash = async (data: string): Promise<string> => {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const handleVerify = async () => {
    if (!data) return
    
    try {
      setVerifying(true)
      
      const p1Data = JSON.stringify(data.p1Rolls) + data.verificationSalt
      const p2Data = JSON.stringify(data.p2Rolls) + data.verificationSalt
      
      const p1Hash = await calculateHash(p1Data)
      const p2Hash = await calculateHash(p2Data)

      const originalHashes = JSON.parse(data.rngHash)
      const originalP1Hash = originalHashes.p1Hash
      const originalP2Hash = originalHashes.p2Hash

      const p1Valid = p1Hash === originalP1Hash
      const p2Valid = p2Hash === originalP2Hash

      setVerificationResult({ p1Valid, p2Valid, p1Hash, p2Hash, originalP1Hash, originalP2Hash })
    } catch (error: any) {
      console.error('Ошибка проверки:', error)
      alert(`Ошибка: ${error.message}`)
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <PageLayout title="Проверка честности" showBack={true}>
        <div className="verification-loading">Загрузка данных игры...</div>
      </PageLayout>
    )
  }

  if (!data) {
    return (
      <PageLayout title="Проверка честности" showBack={true}>
        <div className="verification-error">Данные игры не найдены</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Проверка честности игры" showBack={true}>
      <div className="verification-notebook">
        <div className="notebook-header">
          <h1>Проверка честности игры #{data.gameId.substring(0, 8)}</h1>
          <button className="verify-button" onClick={handleVerify} disabled={verifying || verificationResult !== null}>
            {verifying ? 'Проверяем...' : verificationResult ? 'Проверено' : 'Выполнить проверку'}
          </button>
        </div>

        {verificationResult && (
          <div className={`verification-status ${verificationResult.p1Valid && verificationResult.p2Valid ? 'success' : 'error'}`}>
            <h2>
              {verificationResult.p1Valid && verificationResult.p2Valid ? '✅ Проверка пройдена' : '❌ Проверка не пройдена'}
            </h2>
            <p>
              {verificationResult.p1Valid && verificationResult.p2Valid 
                ? 'Хеши последовательностей совпадают с исходными. Игра была честной.' 
                : 'Обнаружено несоответствие хешей. Возможна манипуляция данными.'}
            </p>
          </div>
        )}

        <div className="notebook-section">
          <h2>Исходные данные</h2>
          <div className="notebook-entry">
            <div className="entry-label">Хеш последовательности (SHA-256):</div>
            <div className="entry-value">
              <div className="hash-block">
                <div className="hash-label">P1 Hash:</div>
                <code>{verificationResult ? verificationResult.originalP1Hash : JSON.parse(data.rngHash).p1Hash}</code>
              </div>
              <div className="hash-block">
                <div className="hash-label">P2 Hash:</div>
                <code>{verificationResult ? verificationResult.originalP2Hash : JSON.parse(data.rngHash).p2Hash}</code>
              </div>
            </div>
          </div>

          <div className="notebook-entry">
            <div className="entry-label">Соль верификации:</div>
            <div className="entry-value">
              <code>{data.verificationSalt}</code>
            </div>
          </div>

          <div className="notebook-entry">
            <div className="entry-label">Смещения игроков:</div>
            <div className="entry-value">
              <div>Игрок 1: <strong>{data.p1Offset}</strong></div>
              <div>Игрок 2: <strong>{data.p2Offset}</strong></div>
            </div>
          </div>
        </div>

        <div className="notebook-section">
          <h2>Последовательности бросков</h2>
          
          <div className="rolls-container">
            <div className="rolls-column">
              <h3>Игрок 1 (1000 бросков)</h3>
              <div className="rolls-list">
                {data.p1Rolls.map((roll, index) => (
                  <div key={index} className="roll-item">
                    [{roll[0]}, {roll[1]}]
                  </div>
                ))}
              </div>
            </div>

            <div className="rolls-column">
              <h3>Игрок 2 (1000 бросков)</h3>
              <div className="rolls-list">
                {data.p2Rolls.map((roll, index) => (
                  <div key={index} className="roll-item">
                    [{roll[0]}, {roll[1]}]
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {verificationResult && (
          <div className="notebook-section">
            <h2>Результаты проверки</h2>
            
            <div className="verification-details">
              <div className={`verification-player ${verificationResult.p1Valid ? 'valid' : 'invalid'}`}>
                <h3>Игрок 1: {verificationResult.p1Valid ? '✅ Валиден' : '❌ Невалиден'}</h3>
                <div className="hash-comparison">
                  <div className="hash-row">
                    <span className="hash-label">Ожидается:</span>
                    <code className="hash-value">{verificationResult.originalP1Hash}</code>
                  </div>
                  <div className="hash-row">
                    <span className="hash-label">Вычислено:</span>
                    <code className={`hash-value ${verificationResult.p1Valid ? 'match' : 'mismatch'}`}>
                      {verificationResult.p1Hash}
                    </code>
                  </div>
                  <div className="hash-status">
                    {verificationResult.p1Valid ? '✅ Совпадает' : '❌ Не совпадает'}
                  </div>
                </div>
              </div>

              <div className={`verification-player ${verificationResult.p2Valid ? 'valid' : 'invalid'}`}>
                <h3>Игрок 2: {verificationResult.p2Valid ? '✅ Валиден' : '❌ Невалиден'}</h3>
                <div className="hash-comparison">
                  <div className="hash-row">
                    <span className="hash-label">Ожидается:</span>
                    <code className="hash-value">{verificationResult.originalP2Hash}</code>
                  </div>
                  <div className="hash-row">
                    <span className="hash-label">Вычислено:</span>
                    <code className={`hash-value ${verificationResult.p2Valid ? 'match' : 'mismatch'}`}>
                      {verificationResult.p2Hash}
                    </code>
                  </div>
                  <div className="hash-status">
                    {verificationResult.p2Valid ? '✅ Совпадает' : '❌ Не совпадает'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="notebook-section">
          <h2>Как работает проверка</h2>
          <div className="explanation">
            <p>
              1. Перед началом игры генерируются две последовательности по 1000 бросков кубиков для каждого игрока.
            </p>
            <p>
              2. Каждая последовательность хешируется с использованием SHA-256 вместе с солью верификации.
            </p>
            <p>
              3. Хеши сохраняются до начала игры, а последовательности и соль скрыты до окончания игры.
            </p>
            <p>
              4. После окончания игры вы можете проверить, что хеш последовательностей совпадает с исходным хешем.
            </p>
            <p>
              5. Если хеши совпадают, значит последовательности не были изменены, и игра была честной.
            </p>
            <p>
              6. Смещения игроков используются для выбора конкретного броска из последовательности.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}

