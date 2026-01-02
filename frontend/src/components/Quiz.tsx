import { useState } from 'react'
import { apiClient } from '../api/client'
import './Quiz.css'

interface Question {
  id: number
  question: string
  options: string[]
  correctAnswer: number
}

interface QuizProps {
  courseId: string
  quiz: {
    questions: Question[]
  }
  quizPassed?: boolean
  onComplete?: (result: { correct: number; total: number; passed: boolean }) => void
}

export default function Quiz({ courseId, quiz, quizPassed = false, onComplete }: QuizProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<{ [questionId: number]: number }>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ correct: number; total: number; passed: boolean } | null>(null)

  const handleAnswerSelect = (questionId: number, answerIndex: number) => {
    if (quizPassed || result) return // Не позволяем менять ответы после прохождения
    setSelectedAnswers(prev => ({ ...prev, [questionId]: answerIndex }))
  }

  const handleSubmit = async () => {
    const allAnswered = quiz.questions.every(q => selectedAnswers[q.id] !== undefined)
    if (!allAnswered) {
      alert('Пожалуйста, ответьте на все вопросы')
      return
    }

    setSubmitting(true)
    try {
      const answers = quiz.questions.map(q => ({
        questionId: q.id,
        answer: selectedAnswers[q.id],
      }))

      const response = await apiClient.post(`/academy/courses/${courseId}/quiz/submit`, answers)
      setResult(response.data)
      if (onComplete) {
        onComplete(response.data)
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ошибка при отправке ответов')
    } finally {
      setSubmitting(false)
    }
  }

  if (quizPassed && !result) {
    return (
      <div className="quiz-container">
        <div className="quiz-header">
          <h3>Тест пройден</h3>
          <p>Вы уже прошли этот тест!</p>
        </div>
      </div>
    )
  }

  if (result) {
    return (
      <div className="quiz-container">
        <div className="quiz-header">
          <h3>{result.passed ? '✅ Тест пройден!' : '❌ Тест не пройден'}</h3>
          <p>Правильных ответов: {result.correct} из {result.total}</p>
          {result.passed && result.reward && (
            <div className="quiz-reward">
              <p>🎁 Вы получили награду!</p>
              {result.reward.narCoin && <p>+{result.reward.narCoin} NAR</p>}
              {result.reward.xp && <p>+{result.reward.xp} XP</p>}
            </div>
          )}
        </div>
        <div className="quiz-results">
          {quiz.questions.map((question) => {
            const userAnswer = selectedAnswers[question.id]
            const isCorrect = userAnswer === question.correctAnswer
            return (
              <div key={question.id} className={`quiz-question-result ${isCorrect ? 'correct' : 'incorrect'}`}>
                <h4>{question.question}</h4>
                <div className="quiz-answer">
                  <p>Ваш ответ: {question.options[userAnswer]}</p>
                  {!isCorrect && (
                    <p className="correct-answer">Правильный ответ: {question.options[question.correctAnswer]}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <h3>Тест по курсу</h3>
        <p>Ответьте на все вопросы для завершения курса</p>
      </div>
      <div className="quiz-questions">
        {quiz.questions.map((question, index) => (
          <div key={question.id} className="quiz-question">
            <h4>
              Вопрос {index + 1}: {question.question}
            </h4>
            <div className="quiz-options">
              {question.options.map((option, optionIndex) => (
                <label
                  key={optionIndex}
                  className={`quiz-option ${selectedAnswers[question.id] === optionIndex ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    checked={selectedAnswers[question.id] === optionIndex}
                    onChange={() => handleAnswerSelect(question.id, optionIndex)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="quiz-actions">
        <button
          className="quiz-submit-btn"
          onClick={handleSubmit}
          disabled={submitting || quiz.questions.some(q => selectedAnswers[q.id] === undefined)}
        >
          {submitting ? 'Отправка...' : 'Отправить ответы'}
        </button>
      </div>
    </div>
  )
}

