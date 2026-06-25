import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Sparkles, Bot, User, Trash2, ImagePlus, XCircle, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../../store'
import { useTranslation } from '../../lib/i18n'
import { useDashboardData } from '../../hooks/useDashboardData'
import { buildAIContext } from '../../lib/analytics'
import { useObjections } from '../../api/queries'

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/**
 * Use gemini-2.5-flash — stable GA release, multimodal, 1M context.
 * Override with VITE_GEMINI_MODEL env var if needed.
 */
const GEMINI_MODEL   = import.meta.env.VITE_GEMINI_MODEL ?? 'gemini-2.5-flash'
const REQUEST_TIMEOUT_MS = 45_000   // 45 s — Gemini can be slow on first token

const MAX_IMAGE_DIM   = 1536         // px — Gemini vision sweet spot
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const ACCEPTED_TYPES  = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface AttachedImage {
  dataUrl:      string   // data:image/jpeg;base64,… for display
  base64:       string   // raw base64 for Gemini inlineData
  mimeType:     string   // always 'image/jpeg' after canvas resize
  originalName: string
}

interface Message {
  role:          'user' | 'model'
  text:          string
  imageDataUrl?: string    // user messages only
  isError?:      boolean   // model error messages
}

// ─────────────────────────────────────────────
// Page labels
// ─────────────────────────────────────────────

const PAGE_LABELS: Record<string, { en: string; es: string }> = {
  '/':               { en: 'Overview Dashboard',          es: 'Vista General' },
  '/simulations':    { en: 'Simulations Log',             es: 'Registro de Simulaciones' },
  '/conversational': { en: 'Conversational Intelligence', es: 'Inteligencia Conversacional' },
  '/coaching':       { en: 'AI Coaching',                 es: 'Coaching IA' },
  '/leaderboard':    { en: 'Leaderboard',                 es: 'Clasificación' },
  '/activities':     { en: 'Activities',                  es: 'Actividades' },
  '/organization':   { en: 'Organization',                es: 'Organización' },
  '/business-lines': { en: 'Business Lines',              es: 'Líneas de Negocio' },
  '/reports':        { en: 'Reports',                     es: 'Reportes' },
  '/settings':       { en: 'Settings',                    es: 'Configuración' },
}

// ─────────────────────────────────────────────
// Image processing
// ─────────────────────────────────────────────

/**
 * Resize an image using Canvas and convert to JPEG.
 * Keeps aspect ratio ≤ MAX_IMAGE_DIM px. Iteratively reduces quality
 * until the base64 payload fits under MAX_IMAGE_BYTES.
 */
async function processImageFile(
  fileOrBlob: File | Blob,
  name = 'image',
): Promise<AttachedImage> {
  return new Promise((resolve, reject) => {
    if (!fileOrBlob.type.startsWith('image/')) {
      reject(new Error(`Unsupported type: ${fileOrBlob.type}`))
      return
    }

    const objectUrl = URL.createObjectURL(fileOrBlob)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img
      if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
        const ratio = Math.min(MAX_IMAGE_DIM / width, MAX_IMAGE_DIM / height)
        width  = Math.round(width  * ratio)
        height = Math.round(height * ratio)
      }

      const canvas  = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas context unavailable')); return }

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      let quality = 0.88
      let dataUrl = canvas.toDataURL('image/jpeg', quality)
      while (dataUrl.length * 0.75 > MAX_IMAGE_BYTES && quality > 0.4) {
        quality -= 0.1
        dataUrl = canvas.toDataURL('image/jpeg', quality)
      }

      resolve({
        dataUrl,
        base64:       dataUrl.split(',')[1],
        mimeType:     'image/jpeg',
        originalName: name,
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }

    img.src = objectUrl
  })
}

// ─────────────────────────────────────────────
// Error classification
// ─────────────────────────────────────────────

function classifyError(err: unknown, language: 'es' | 'en'): string {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()

  if (lower.includes('api_key') || lower.includes('api key') || lower.includes('401') || lower.includes('403')) {
    return language === 'es'
      ? 'API key inválida o no autorizada. Verifica VITE_GEMINI_API_KEY.'
      : 'Invalid or unauthorized API key. Check your VITE_GEMINI_API_KEY.'
  }
  if (lower.includes('429') || lower.includes('quota') || lower.includes('rate')) {
    return language === 'es'
      ? 'Límite de solicitudes alcanzado. Intenta en unos segundos.'
      : 'Rate limit reached. Please wait a moment and try again.'
  }
  if (lower.includes('404') || lower.includes('not found') || lower.includes('model')) {
    return language === 'es'
      ? `Modelo no encontrado: ${GEMINI_MODEL}. Verifica tu configuración.`
      : `Model not found: ${GEMINI_MODEL}. Check your configuration.`
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('aborted')) {
    return language === 'es'
      ? 'La solicitud tardó demasiado. Intenta de nuevo o simplifica tu pregunta.'
      : 'Request timed out. Try again or simplify your question.'
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
    return language === 'es'
      ? 'Error de red. Verifica tu conexión a internet.'
      : 'Network error. Check your internet connection.'
  }
  return language === 'es'
    ? `Error al conectar con Gemini: ${msg.slice(0, 120)}`
    : `Error connecting to Gemini: ${msg.slice(0, 120)}`
}

// ─────────────────────────────────────────────
// Markdown renderer components
// ─────────────────────────────────────────────

const mdComponents = {
  p:      ({ children }: { children?: React.ReactNode }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  ul:     ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
  ol:     ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
  li:     ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-slate-100">{children}</strong>,
  em:     ({ children }: { children?: React.ReactNode }) => <em className="italic text-slate-400">{children}</em>,
  code:   ({ children }: { children?: React.ReactNode }) => (
    <code className="bg-white/10 rounded px-1 py-0.5 text-xs font-mono text-accent">{children}</code>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => <h1 className="font-bold text-slate-100 text-base mb-1">{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="font-semibold text-slate-100 text-sm mb-1">{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="font-medium text-slate-200 text-sm mb-1">{children}</h3>,
}

const greetingMdComponents = {
  p:      ({ children }: { children?: React.ReactNode }) => <p className="mb-1 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-accent">{children}</strong>,
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function AIAssistant() {
  const { aiOpen, toggleAI, language } = useAppStore()
  const t = useTranslation(language)
  const location = useLocation()

  // Dashboard data — used for context, but AI works even if unavailable
  const { kpis, sims, activities, actStats, userStats, isLoading: dashLoading } = useDashboardData()
  const { data: objStats } = useObjections()

  const [messages,      setMessages]      = useState<Message[]>([])
  const [input,         setInput]         = useState('')
  const [thinking,      setThinking]      = useState(false)   // waiting for first token
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null)
  const [imageError,    setImageError]    = useState<string | null>(null)

  const bottomRef    = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  // Abort flag — set when we want the stream loop to stop
  const abortRef     = useRef<{ shouldAbort: boolean }>({ shouldAbort: false })

  const pageName = PAGE_LABELS[location.pathname]?.[language] ?? location.pathname

  // Auto-scroll when messages change or while streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  // Abort any in-flight stream when panel closes
  useEffect(() => {
    if (!aiOpen) abortRef.current.shouldAbort = true
  }, [aiOpen])

  // Focus input when panel opens
  useEffect(() => {
    if (aiOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 120)
      return () => clearTimeout(timer)
    }
  }, [aiOpen])

  // ── Image helpers ──────────────────────────────

  const attachImage = useCallback(async (fileOrBlob: File | Blob, name?: string) => {
    setImageError(null)
    try {
      const processed = await processImageFile(fileOrBlob, name)
      setAttachedImage(processed)
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Image processing failed')
    }
  }, [])

  const removeImage = useCallback(() => {
    setAttachedImage(null)
    setImageError(null)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    attachImage(file, file.name)
    e.target.value = ''
  }, [attachImage])

  // Clipboard paste — capture image items, let text paste through normally
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const imageItem = Array.from(e.clipboardData.items)
      .find((item) => item.type.startsWith('image/'))
    if (!imageItem) return
    e.preventDefault()
    const blob = imageItem.getAsFile()
    if (blob) attachImage(blob, 'pasted-image')
  }, [attachImage])

  // ── Build dashboard context (null-safe) ───────

  function buildContext(): string {
    const lang = language === 'es' ? 'Spanish' : 'English'
    let ctx = `[Current page: ${pageName}]\n[Language: ${lang}]\n\n`

    if (kpis && !dashLoading) {
      ctx += buildAIContext(kpis, sims, activities, actStats ?? [], userStats ?? [], objStats ?? [])
    } else {
      ctx +=
        'DASHBOARD DATA: Currently loading or unavailable.\n' +
        'You can still answer general questions about sales enablement,\n' +
        'coaching best practices, or the M8 pharma simulation platform.'
    }

    return ctx
  }

  // ── Main send handler ─────────────────────────

  const handleSend = async () => {
    const hasText  = !!input.trim()
    const hasImage = !!attachedImage
    if (!hasText && !hasImage) return
    if (thinking) return

    const userText     = input.trim()
    const imageForSend = attachedImage

    // Optimistic UI update
    setInput('')
    setAttachedImage(null)
    setImageError(null)
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: userText, imageDataUrl: imageForSend?.dataUrl },
    ])
    setThinking(true)

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY

    if (!apiKey) {
      setMessages((prev) => [...prev, { role: 'model', text: t('ai_no_key'), isError: true }])
      setThinking(false)
      return
    }

    // Build full prompt text
    const lang = language === 'es' ? 'Spanish' : 'English'

    // When an image is present, give a clear, explicit vision instruction so
    // the model knows it MUST describe what it sees — not just use the text context.
    const imageInstruction = imageForSend
      ? (language === 'es'
          ? '\n\nSe ha adjuntado una imagen a este mensaje. ' +
            'PRIMERO: describe con detalle lo que ves en la imagen — números, gráficas, tablas, ' +
            'porcentajes, nombres de usuarios, colores y cualquier dato visible. ' +
            'DESPUÉS: relaciona esas observaciones con los datos del dashboard de arriba. ' +
            'Si el usuario hizo una pregunta adicional, respóndela basándote en lo que ves en la imagen.'
          : '\n\nAn image has been attached to this message. ' +
            'FIRST: describe in detail what you see in the image — numbers, charts, tables, ' +
            'percentages, user names, colors, and any visible data. ' +
            'THEN: relate those observations to the dashboard data above. ' +
            'If the user asked an additional question, answer it based on what you see in the image.')
      : ''

    const userQuestion = userText
      ? `\n\nUser question (${lang}): ${userText}`
      : imageForSend
        ? `\n\n(No additional text — please analyse the image as instructed above.)`
        : ''

    const fullPrompt =
      buildContext() +
      imageInstruction +
      `\n\nYou are the M8 pharma Sales Training AI assistant. Respond in ${lang}. ` +
      `The user is on the "${pageName}" page. Be concise, data-driven, and actionable.` +
      userQuestion

    // Validate image data before sending
    if (imageForSend && (!imageForSend.base64 || imageForSend.base64.length < 100)) {
      setThinking(false)
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: language === 'es'
            ? 'No se pudo procesar la imagen. Intenta con otra imagen.'
            : 'Image could not be processed. Please try a different image.',
          isError: true,
        },
      ])
      return
    }

    // Reset abort flag for this new request
    abortRef.current.shouldAbort = false

    // Timeout promise
    let timeoutId: ReturnType<typeof setTimeout>
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Request timed out after 45 s')),
        REQUEST_TIMEOUT_MS,
      )
    })

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

      /**
       * Build parts with their exact individual types so TypeScript can resolve
       * each to the correct member of the SDK's discriminated Part union.
       *
       * Image is placed BEFORE the text prompt — the model processes visual
       * context first, which produces more grounded image analysis responses.
       */
      const textPart  = { text: fullPrompt }                       // → TextPart
      const imagePart = imageForSend
        ? { inlineData: { mimeType: imageForSend.mimeType, data: imageForSend.base64 } }  // → InlineDataPart
        : null

      // Race the stream initiation against timeout
      const streamResult = await Promise.race([
        imagePart
          ? model.generateContentStream([imagePart, textPart])     // multimodal: image + text
          : model.generateContentStream(fullPrompt),               // text-only
        timeoutPromise,
      ])

      clearTimeout(timeoutId!)

      // Stream text chunks into the last message slot
      let fullText   = ''
      let firstChunk = true

      for await (const chunk of streamResult.stream) {
        if (abortRef.current.shouldAbort) break

        const text = chunk.text()
        if (!text) continue

        fullText += text

        if (firstChunk) {
          // First token arrived — replace thinking dots with the message
          setThinking(false)
          setMessages((prev) => [...prev, { role: 'model', text: fullText }])
          firstChunk = false
        } else {
          // Subsequent chunks — update last message in place
          setMessages((prev) => {
            const updated = [...prev]
            const last    = updated[updated.length - 1]
            if (last?.role === 'model') {
              updated[updated.length - 1] = { ...last, text: fullText }
            }
            return updated
          })
        }
      }

      // Edge case: stream ended with no chunks (empty response)
      if (firstChunk) {
        setThinking(false)
        setMessages((prev) => [
          ...prev,
          {
            role: 'model',
            text: language === 'es'
              ? 'No se recibió respuesta del modelo. Intenta de nuevo.'
              : 'No response received from the model. Please try again.',
            isError: true,
          },
        ])
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId!)
      setThinking(false)
      if (!abortRef.current.shouldAbort) {
        console.error('[AIAssistant] Request failed:', err)
        setMessages((prev) => [
          ...prev,
          { role: 'model', text: classifyError(err, language), isError: true },
        ])
      }
    }
  }

  // ── Clear handler ─────────────────────────────

  const handleClear = useCallback(() => {
    abortRef.current.shouldAbort = true
    setMessages([])
    setAttachedImage(null)
    setImageError(null)
    setThinking(false)
  }, [])

  // ── Derived state ─────────────────────────────

  const isStreaming = thinking === false && messages.length > 0 &&
    messages[messages.length - 1]?.role === 'model' &&
    messages[messages.length - 1]?.text === ''

  const canSend = !thinking && !isStreaming && (!!input.trim() || !!attachedImage)

  const greeting = language === 'es'
    ? `¡Hola! Soy el asistente IA de **M8 pharma**. Estás en **${pageName}**. Puedo analizar el rendimiento del equipo comercial, comparar líneas de negocio e identificar áreas de mejora. También puedes **pegar o adjuntar imágenes** del dashboard para análisis visual. ¿En qué te puedo ayudar?`
    : `Hello! I'm the **M8 pharma** AI assistant. You're viewing **${pageName}**. I can analyze sales team performance, compare business lines, and identify improvement areas. You can also **paste or attach dashboard screenshots** for visual analysis. How can I help?`

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <>
      {/* ── Mobile backdrop (panel open) ── */}
      <AnimatePresence>
        {aiOpen && (
          <motion.div
            key="ai-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 sm:hidden"
            onClick={toggleAI}
          />
        )}
      </AnimatePresence>

      {/* ── Chat panel (panel open) ── */}
      <AnimatePresence>
        {aiOpen && (
          <motion.div
            initial={{ opacity: 0, x: 320 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 320 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-dvh w-full sm:w-[380px] max-w-full bg-surface border-l border-line/40 shadow-elevated z-50 flex flex-col"
          >
            {/* ── Header ── */}
            <div className="h-14 shrink-0 border-b border-line/30 flex items-center justify-between px-4">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-violet shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-100 leading-tight">{t('ai_title')}</h3>
                  <p className="text-[10px] text-slate-600 truncate">
                    {t('ai_subtitle')} · <span className="text-accent/80">{pageName}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={handleClear}
                  className="p-1.5 rounded-md text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors"
                  title={t('ai_clear')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={toggleAI}
                  className="p-1.5 rounded-md text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors"
                  title={t('close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
              {/* Greeting (empty state) */}
              {messages.length === 0 && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-violet/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-violet" />
                  </div>
                  <div className="bg-card rounded-xl rounded-tl-none px-3 py-2.5 text-sm text-slate-300 leading-relaxed border border-line/30">
                    <ReactMarkdown components={greetingMdComponents}>{greeting}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Message history */}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Bot avatar */}
                  {m.role === 'model' && (
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      m.isError ? 'bg-danger/10' : 'bg-violet/10'
                    }`}>
                      {m.isError
                        ? <AlertCircle className="w-3.5 h-3.5 text-danger" />
                        : <Bot className="w-3.5 h-3.5 text-violet" />
                      }
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    className={`max-w-[85%] rounded-xl text-sm leading-relaxed border ${
                      m.role === 'user'
                        ? 'bg-accent/10 text-accent border-accent/20 rounded-tr-none'
                        : m.isError
                          ? 'bg-danger/5 text-danger border-danger/20 rounded-tl-none'
                          : 'bg-card text-slate-300 border-line/30 rounded-tl-none'
                    }`}
                  >
                    {/* Attached image preview (user messages) */}
                    {m.imageDataUrl && (
                      <div className="p-2 pb-0">
                        <img
                          src={m.imageDataUrl}
                          alt="Attached"
                          className="rounded-lg max-w-full max-h-48 object-contain bg-black/20"
                        />
                      </div>
                    )}

                    {/* Text — stream cursor on last streaming message */}
                    {m.text ? (
                      <div className="px-3 py-2.5">
                        {m.role === 'user' ? (
                          <span>{m.text}</span>
                        ) : (
                          <ReactMarkdown components={mdComponents}>{m.text}</ReactMarkdown>
                        )}
                      </div>
                    ) : (
                      /* Empty model message = stream hasn't started yet (should be very brief) */
                      <div className="px-3 py-2.5 text-slate-600 text-xs italic">
                        {language === 'es' ? 'Escribiendo…' : 'Typing…'}
                      </div>
                    )}
                  </div>

                  {/* User avatar */}
                  {m.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-accent" />
                    </div>
                  )}
                </div>
              ))}

              {/* Thinking / waiting-for-first-token indicator */}
              {thinking && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-violet/10 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-violet animate-pulse" />
                  </div>
                  <div className="bg-card rounded-xl rounded-tl-none px-3 py-2 border border-line/30">
                    <div className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* ── Input area ── */}
            <div className="shrink-0 border-t border-line/30 p-3 safe-bottom space-y-2">
              {/* Image preview */}
              {attachedImage && (
                <div className="relative inline-flex">
                  <img
                    src={attachedImage.dataUrl}
                    alt={attachedImage.originalName}
                    className="h-20 w-auto max-w-full rounded-lg object-cover border border-line/40 bg-black/20"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-800 border border-line/60 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors"
                    title={language === 'es' ? 'Quitar imagen' : 'Remove image'}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-slate-300 px-1 rounded truncate max-w-[90%]">
                    {attachedImage.originalName}
                  </span>
                </div>
              )}

              {/* Image error */}
              {imageError && (
                <p className="text-[11px] text-danger px-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {imageError}
                </p>
              )}

              {/* Input row */}
              <div className="flex items-center gap-2 bg-card border border-line/60 rounded-xl px-2.5 py-2 focus-within:border-accent/40 transition-colors">
                {/* Image upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={thinking}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-40 shrink-0"
                  title={language === 'es'
                    ? 'Adjuntar imagen (o pega con Ctrl+V)'
                    : 'Attach image (or paste with Ctrl+V)'}
                >
                  <ImagePlus className="w-4 h-4" />
                </button>

                {/* Hidden file picker */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(',')}
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {/* Text input */}
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  onPaste={handlePaste}
                  placeholder={
                    attachedImage
                      ? (language === 'es' ? 'Pregunta sobre la imagen...' : 'Ask about the image...')
                      : t('ai_placeholder')
                  }
                  disabled={thinking}
                  className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none min-w-0 disabled:opacity-50"
                />

                {/* Send button */}
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className="p-1.5 rounded-lg bg-accent text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-400 transition-colors shrink-0"
                  title={t('ai_send')}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Paste hint */}
              {messages.length === 0 && !attachedImage && (
                <p className="text-[10px] text-slate-700 text-center select-none">
                  {language === 'es'
                    ? 'Ctrl+V para pegar imágenes del portapapeles'
                    : 'Ctrl+V to paste images from clipboard'}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
