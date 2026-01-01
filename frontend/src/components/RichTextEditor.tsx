import { useState, useRef, useEffect } from 'react'
import { apiClient } from '../api/client'
import './RichTextEditor.css'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function RichTextEditor({ value, onChange, placeholder = 'Введите текст...' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleInput()
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('Размер файла не должен превышать 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('Выберите изображение')
      return
    }

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      const response = await apiClient.post('/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (response.data?.url) {
        execCommand('insertImage', response.data.url)
      }
    } catch (error: any) {
      console.error('Failed to upload image:', error)
      alert(error.response?.data?.message || 'Ошибка загрузки изображения')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar">
        <button
          type="button"
          className="rich-text-btn"
          onClick={() => execCommand('bold')}
          title="Жирный"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className="rich-text-btn"
          onClick={() => execCommand('italic')}
          title="Курсив"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className="rich-text-btn"
          onClick={() => execCommand('underline')}
          title="Подчеркнутый"
        >
          <u>U</u>
        </button>
        <div className="rich-text-divider" />
        <button
          type="button"
          className="rich-text-btn"
          onClick={() => execCommand('formatBlock', 'h2')}
          title="Заголовок 2"
        >
          H2
        </button>
        <button
          type="button"
          className="rich-text-btn"
          onClick={() => execCommand('formatBlock', 'h3')}
          title="Заголовок 3"
        >
          H3
        </button>
        <div className="rich-text-divider" />
        <button
          type="button"
          className="rich-text-btn"
          onClick={() => execCommand('insertUnorderedList')}
          title="Маркированный список"
        >
          •
        </button>
        <button
          type="button"
          className="rich-text-btn"
          onClick={() => execCommand('insertOrderedList')}
          title="Нумерованный список"
        >
          1.
        </button>
        <div className="rich-text-divider" />
        <label className="rich-text-btn" title="Вставить изображение">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={isUploading}
            style={{ display: 'none' }}
          />
          {isUploading ? '...' : '🖼️'}
        </label>
      </div>
      <div
        ref={editorRef}
        className="rich-text-content"
        contentEditable
        onInput={handleInput}
        dangerouslySetInnerHTML={{ __html: value }}
        data-placeholder={placeholder}
      />
    </div>
  )
}

