import { useState, useEffect } from 'react'
import apiClient from '../api/client'
import './TonPaymentModal.css'

interface TonPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  transactionId: string
  walletAddress: string
  amount: number
  comment: string
  method: 'TON' | 'USDT'
  expiresAt?: string | Date
  onSuccess: () => void
}

export default function TonPaymentModal({
  isOpen,
  onClose,
  transactionId,
  walletAddress,
  amount,
  comment,
  method,
  onSuccess,
  expiresAt,
}: TonPaymentModalProps) {
  const [copied, setCopied] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending')
  const [timeRemaining, setTimeRemaining] = useState<number>(900) // 15 минут в секундах

  useEffect(() => {
    if (isOpen && transactionId) {
      // Устанавливаем таймер на основе expiresAt или 15 минут по умолчанию
      if (expiresAt) {
        const expires = new Date(expiresAt)
        const now = new Date()
        const remaining = Math.max(0, Math.floor((expires.getTime() - now.getTime()) / 1000))
        setTimeRemaining(remaining)
      } else {
        setTimeRemaining(900) // 15 минут по умолчанию
      }
      
      // Обновляем таймер каждую секунду
      const timerInterval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 0) {
            setStatus('failed')
            return 0
          }
          return prev - 1
        })
      }, 1000)

      // Начинаем проверку статуса каждые 5 секунд (только если статус processing и есть хеш)
      const statusInterval = setInterval(() => {
        if (status === 'processing' && txHash) {
          checkPaymentStatus()
        }
      }, 5000)
      
      return () => {
        clearInterval(timerInterval)
        clearInterval(statusInterval)
      }
    }
  }, [isOpen, transactionId, expiresAt, status, txHash])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const checkPaymentStatus = async () => {
    if (!transactionId || checking) return
    
    try {
      setChecking(true)
      // Используем универсальный endpoint для всех типов транзакций
      const response = await apiClient.get(`/payment/transaction/${transactionId}/status`)
      const transaction = response.data
      
      if (transaction.status === 'completed') {
        setStatus('completed')
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 2000)
      } else if (transaction.status === 'failed') {
        setStatus('failed')
      } else if (transaction.status === 'processing') {
        setStatus('processing')
      } else if (transaction.status === 'pending') {
        // Если есть expiresAt, обновляем таймер
        if (transaction.expiresAt) {
          const expiresAt = new Date(transaction.expiresAt)
          const now = new Date()
          const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
          setTimeRemaining(remaining)
          if (remaining === 0) {
            setStatus('failed')
          }
        }
      }
    } catch (error) {
      console.error('Failed to check payment status:', error)
    } finally {
      setChecking(false)
    }
  }

  const handleConfirmPayment = async () => {
    if (!txHash.trim()) {
      alert('Введите хеш транзакции')
      return
    }

    try {
      setChecking(true)
      // Используем универсальный endpoint для всех типов транзакций
      await apiClient.post(`/payment/transaction/${transactionId}/confirm`, {
        txHash: txHash.trim(),
      })

      setStatus('processing')
      // Начинаем проверку статуса
      setTimeout(() => checkPaymentStatus(), 2000)
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Ошибка при подтверждении платежа')
      setChecking(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="ton-payment-modal-overlay" onClick={onClose}>
      <div className="ton-payment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ton-payment-modal-header">
          <h3>Оплата через {method}</h3>
          <button className="ton-payment-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="ton-payment-modal-content">
          {/* Таймер обратного отсчета */}
          {(status === 'pending' || status === 'processing') && (
            <div style={{
              padding: '12px',
              marginBottom: '16px',
              borderRadius: '8px',
              background: timeRemaining < 60 ? '#4a1a1a' : '#1a2a1a',
              border: `1px solid ${timeRemaining < 60 ? '#ff4444' : '#44ff44'}`,
              textAlign: 'center',
            }}>
              <div style={{ 
                color: timeRemaining < 60 ? '#ff8888' : '#88ff88',
                fontSize: '14px',
                fontWeight: '500',
                marginBottom: '4px',
              }}>
                Осталось времени на оплату
              </div>
              <div style={{
                color: timeRemaining < 60 ? '#ff4444' : '#44ff44',
                fontSize: '20px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
              }}>
                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
              </div>
            </div>
          )}

          {status === 'completed' ? (
            <div className="ton-payment-success">
              <div className="ton-payment-success-icon">✅</div>
              <h3>Платеж успешно подтвержден!</h3>
              <p>Подписка активируется автоматически...</p>
            </div>
          ) : status === 'failed' ? (
            <div className="ton-payment-error">
              <div className="ton-payment-error-icon">❌</div>
              <h3>Ошибка платежа</h3>
              <p>Платеж не был подтвержден. Проверьте хеш транзакции и попробуйте снова.</p>
              <button onClick={() => setStatus('pending')} className="ton-payment-retry-btn">
                Попробовать снова
              </button>
            </div>
          ) : (
            <>
              <div className="ton-payment-details">
                <div className="ton-payment-detail-item">
                  <label>Адрес кошелька:</label>
                  <div className="ton-payment-address-container">
                    <code className="ton-payment-address">{walletAddress}</code>
                    <button
                      className="ton-payment-copy-btn"
                      onClick={() => copyToClipboard(walletAddress)}
                    >
                      {copied ? '✓ Скопировано' : 'Копировать'}
                    </button>
                  </div>
                </div>

                <div className="ton-payment-detail-item">
                  <label>Сумма:</label>
                  <div className="ton-payment-amount">{amount} {method}</div>
                </div>

                <div className="ton-payment-detail-item">
                  <label>Комментарий <span style={{ color: '#ff4444' }}>*</span>:</label>
                  <div className="ton-payment-comment-container">
                    <code className="ton-payment-comment">{comment}</code>
                    <button
                      className="ton-payment-copy-btn"
                      onClick={() => copyToClipboard(comment)}
                    >
                      {copied ? '✓ Скопировано' : 'Копировать'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="ton-payment-hash-input">
                <label>Хеш транзакции (после отправки):</label>
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="Введите хеш транзакции..."
                  disabled={status === 'processing'}
                />
                <button
                  className="ton-payment-confirm-btn"
                  onClick={handleConfirmPayment}
                  disabled={!txHash.trim() || checking || status === 'processing'}
                >
                  {checking || status === 'processing' ? 'Проверка...' : 'Подтвердить платеж'}
                </button>
              </div>

              {status === 'processing' && (
                <div className="ton-payment-processing">
                  <div className="ton-payment-spinner"></div>
                  <p>Проверяем транзакцию в блокчейне...</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

