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
}: TonPaymentModalProps) {
  const [copied, setCopied] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending')

  useEffect(() => {
    if (isOpen && transactionId) {
      // Начинаем проверку статуса каждые 5 секунд
      const interval = setInterval(() => {
        checkPaymentStatus()
      }, 5000)
      
      return () => clearInterval(interval)
    }
  }, [isOpen, transactionId])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const checkPaymentStatus = async () => {
    if (!transactionId || checking) return
    
    try {
      setChecking(true)
      const response = await apiClient.get(`/subscription/payment/${transactionId}/status`)
      const { data } = await response
      
      if (response.data.status === 'completed') {
        setStatus('completed')
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 2000)
      } else if (response.data.status === 'failed') {
        setStatus('failed')
      } else if (response.data.status === 'processing') {
        setStatus('processing')
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
      await apiClient.post(`/subscription/payment/${transactionId}/confirm`, {
        txHash: txHash.trim(),
      })

      setStatus('processing')
      // Начинаем проверку статуса
      setTimeout(() => checkPaymentStatus(), 2000)
    } catch (error: any) {
      alert(error.message || 'Ошибка при подтверждении платежа')
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
              <div className="ton-payment-instructions">
                <h4>Инструкция по оплате:</h4>
                <ol>
                  <li>Откройте ваш TON кошелек (Tonkeeper, TON Wallet и т.д.)</li>
                  <li>Отправьте <strong>{amount} {method}</strong> на адрес ниже</li>
                  <li>В комментарии к транзакции укажите: <code>{comment}</code></li>
                  <li>После отправки введите хеш транзакции ниже</li>
                </ol>
              </div>

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
                  <label>Комментарий (обязательно!):</label>
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

