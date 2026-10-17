import type React from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

type AvatarState = 'idle' | 'listening' | 'processing' | 'responding' | 'error' | 'degraded'

type Msg = {
  id: number
  files?: string[]
  rating?: 'up' | 'down'
  role: 'user' | 'aoi'
  text: string
  sources?: string[]
  external?: boolean
  warn?: boolean
  time: string
}

const stamp = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const RESEARCH_RE = /compare|analyze|analyse|evaluate/i
const POLICY_RE = /policy|policies|enrollment|tuition|handbook|schedule/i
const HOMEWORK_RE = /homework|essay|solve this|write my/i

const isResearch = (t: string) => RESEARCH_RE.test(t) || t.length > 150

type Route = 'homework' | 'policy' | 'research' | 'general'

function classify(t: string): Route {
  if (HOMEWORK_RE.test(t)) return 'homework'
  if (POLICY_RE.test(t)) return 'policy'
  if (isResearch(t)) return 'research'
  return 'general'
}

function anonymize(t: string) {
  return t
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/\b\d{2}-\d{4,6}\b/g, '[student ID]')
    .replace(/\b(\+?63|0)9\d{9}\b/g, '[phone]')
    .replace(/MSU[-\s]?Zamboanga Sibugay( University)?|MSU-ZSU/gi, 'a regional state university')
    .replace(/\b(my name is|i am|i'm)\s+[A-Z][a-z]+(\s[A-Z][a-z]+)?/g, '$1 [name]')
}

function Avatar({ state, width, variant = 'full' }: { state: AvatarState; width: number; variant?: 'full' | 'face' }) {
  const uid = useId().replace(/:/g, '')
  const err = state === 'error'
  const deg = state === 'degraded'
  const listening = state === 'listening'
  const processing = state === 'processing'
  const talking = state === 'responding'
  const ink = '#0C4A6E'
  const hair = '#7DD3FC'
  const hairDeep = '#38BDF8'
  const skin = '#FFE6D8'
  const look = processing ? { x: 2, y: -3.5 } : listening ? { x: -2, y: -1 } : { x: 0, y: 0 }
  const tilt = listening ? -7 : processing ? 3 : 0
  const face = variant === 'face'
  const height = face ? width : width * 1.2
  const spinner = Math.max(16, width * 0.13)

  const Eye = ({ cx }: { cx: number }) => (
    <g transform={`translate(${cx} 106)`}>
      <g className="aoi-blink">
        <ellipse rx="13" ry="15" fill="#fff" />
        <g style={{ transform: `translate(${look.x}px, ${look.y}px)`, transition: 'transform 0.3s ease' }}>
          <ellipse rx="10" ry="12.5" fill={`url(#${uid}i)`} />
          <ellipse rx="5" ry="7" fill={ink} />
          <circle cx="-3.5" cy="-5" r="3.2" fill="#fff" />
          <circle cx="4" cy="4.5" r="1.6" fill="#fff" opacity="0.9" />
        </g>
        <path d="M-14 -6 Q0 -19 14 -6" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </g>
  )

  return (
    <div className="relative shrink-0" style={{ width, height }} role="img" aria-label={`AOI avatar: ${state}`}>
      {listening && (
        <span
          className="aoi-glow absolute rounded-full"
          style={
            face
              ? { left: '50%', top: '50%', width: width + 10, height: width + 10, boxShadow: '0 0 0 2px rgba(176,30,46,0.9), 0 0 14px 3px rgba(176,30,46,0.55)' }
              : {
                  left: '50%',
                  top: '40%',
                  width: width * 0.86,
                  height: width * 0.86,
                  boxShadow: '0 0 0 3px rgba(176,30,46,0.7), 0 0 36px 8px rgba(176,30,46,0.45)',
                  background: 'radial-gradient(circle, rgba(176,30,46,0.22), transparent 70%)',
                }
          }
        />
      )}
      {processing && face && (
        <span className="aoi-spin absolute rounded-full" style={{ inset: -4, border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#B01E2E' }} />
      )}
      {processing && !face && (
        <span
          className="aoi-spin absolute left-1/2 rounded-full"
          style={{ width: spinner, height: spinner, top: -spinner - 2, marginLeft: -spinner / 2, border: `${Math.max(2, spinner / 9)}px solid rgba(255,255,255,0.15)`, borderTopColor: '#B01E2E' }}
        />
      )}
      {err && face && <span className="absolute rounded-full" style={{ inset: -3, border: '2px solid #B01E2E' }} />}
      <div className={face ? 'h-full w-full overflow-hidden rounded-full' : 'h-full w-full'} style={face ? { background: 'linear-gradient(160deg, #475569, #1E293B)' } : undefined}>
        <div className="aoi-char h-full w-full transition-[filter] duration-300" style={{ filter: deg ? 'grayscale(1)' : 'none' }}>
        <svg viewBox={face ? '30 14 140 140' : '0 0 200 240'} className={`h-full w-full ${face ? '' : 'overflow-visible'}`}>
          <defs>
            <linearGradient id={`${uid}i`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0369A1" />
              <stop offset="1" stopColor="#38BDF8" />
            </linearGradient>
          </defs>

          <path
            d="M52 96C46 40 78 14 100 14C122 14 154 40 148 96C152 140 150 175 160 205C130 214 70 214 40 205C50 175 48 140 52 96Z"
            fill={hairDeep}
          />
          <rect x="89" y="132" width="22" height="50" rx="8" fill="#F7CDBA" />
          <path d="M26 240C26 204 50 182 100 178C150 182 174 204 174 240Z" fill="#2B3A55" />
          <path d="M78 179L100 222L122 179Z" fill="#FFFFFF" />
          <path d="M78 179L100 198L90 178Z M122 179L100 198L110 178Z" fill="#F3F4F6" />
          <path d="M100 198L82 190L82 206Z M100 198L118 190L118 206Z" fill="#800000" />
          <circle cx="100" cy="198" r="5" fill="#600000" />
          <path d="M78 179L66 240M122 179L134 240" stroke="#3B4B68" strokeWidth="2" />

          <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: '100px 150px', transition: 'transform 0.4s ease' }}>
            <ellipse cx="55" cy="104" rx="5" ry="8" fill={skin} />
            <ellipse cx="145" cy="104" rx="5" ry="8" fill={skin} />
            <path d="M56 92C56 58 76 44 100 44C124 44 144 58 144 92C144 124 124 146 100 151C76 146 56 124 56 92Z" fill={skin} />
            <ellipse cx="71" cy="118" rx="9" ry="5" fill="#FDA4AF" opacity="0.5" />
            <ellipse cx="129" cy="118" rx="9" ry="5" fill="#FDA4AF" opacity="0.5" />

            <Eye cx={80} />
            <Eye cx={120} />

            <g style={{ transform: `translateY(${processing ? -3 : 0}px)`, transition: 'transform 0.3s ease' }} stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" fill="none">
              {err ? (
                <>
                  <path d="M66 86Q80 82 92 76" />
                  <path d="M134 86Q120 82 108 76" />
                </>
              ) : (
                <>
                  <path d="M66 86Q79 78 92 83" />
                  <path d="M134 86Q121 78 108 83" />
                </>
              )}
            </g>

            <path d="M100 121q-2 3.5 1 3.5" stroke="#F0B8A2" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            {talking ? (
              <ellipse cx="100" cy="133" rx="6" ry="4.5" fill="#9F3B45" className="aoi-talk" />
            ) : processing ? (
              <ellipse cx="100" cy="134" rx="3" ry="3.5" fill="#B4535A" />
            ) : err ? (
              <path d="M92 137Q100 129 108 137" stroke="#B4535A" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            ) : (
              <path d="M92 131Q100 138 108 131" stroke="#B4535A" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            )}
            {err && <path d="M141 72c-5 8-5 12 0 12s5-4 0-12Z" fill="#BAE6FD" />}

            <path
              d="M50 104C44 50 72 22 100 22C128 22 156 50 150 104C148 90 144 76 138 68C134 80 128 84 124 84C122 72 116 62 108 58C106 72 100 82 94 84C90 74 84 66 76 62C74 76 68 86 64 90C58 94 54 98 50 104Z"
              fill={hair}
              stroke={hairDeep}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M70 40Q100 26 130 40" stroke="#fff" strokeOpacity="0.6" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M100 24C95 8 108 0 113 9C107 9 105 18 105 26Z" fill={hair} stroke={hairDeep} strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M50 100C44 130 44 160 50 188C61 178 63 150 58 118Z" fill={hair} stroke={hairDeep} strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M150 100C156 130 156 160 150 188C139 178 137 150 142 118Z" fill={hair} stroke={hairDeep} strokeWidth="1.5" strokeLinejoin="round" />
            <g transform="rotate(-25 130 44)" fill="#800000">
              <rect x="121" y="40" width="18" height="6" rx="3" />
            </g>
            {err && (
              <g>
                <circle cx="166" cy="36" r="11" fill="#800000" />
                <rect x="164.5" y="28" width="3" height="10" rx="1.5" fill="#fff" />
                <circle cx="166" cy="42" r="1.8" fill="#fff" />
              </g>
            )}
          </g>
        </svg>
        </div>
      </div>
      {face && !deg && (
        <span
          aria-label="Online"
          className="absolute rounded-full bg-[#22C55E] shadow-[0_0_0_2px_#1E293B]"
          style={{ right: 0, bottom: 0, width: 11, height: 11 }}
        />
      )}
      {deg && (
        <span
          className="absolute flex items-center justify-center rounded-full border-2 border-[#111111] bg-white font-bold text-[#111111]"
          style={
            face
              ? { right: -4, bottom: -4, width: 16, height: 16, fontSize: 10 }
              : { right: '6%', top: '4%', width: Math.max(16, width * 0.16), height: Math.max(16, width * 0.16), fontSize: Math.max(10, width * 0.1) }
          }
        >
          !
        </span>
      )}
    </div>
  )
}

function SourceChip({ label, external }: { label: string; external?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-[12px] border border-t-line2 px-3 py-1.5 text-[12px] font-medium text-t-fg transition-all active:scale-95 ${external ? 'bg-t-deep hover:brightness-95' : 'bg-t-line hover:brightness-95'}`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6M9 17h4" />
      </svg>
      {label}
    </button>
  )
}

const BACKGROUNDS = [
  { id: 'default', name: 'Default', css: 'var(--bg)' },
  {
    id: 'grid',
    name: 'Tech Grid',
    css: 'linear-gradient(rgb(var(--tint-rgb) / 0.07) 1px, transparent 1px) 0 0 / 28px 28px, linear-gradient(90deg, rgb(var(--tint-rgb) / 0.07) 1px, transparent 1px) 0 0 / 28px 28px, var(--bg)',
  },
  {
    id: 'shapes',
    name: 'Abstract',
    css: 'radial-gradient(circle at 12% 18%, var(--shape-a) 0, transparent 38%), radial-gradient(circle at 88% 42%, var(--shape-b) 0, transparent 40%), radial-gradient(circle at 30% 92%, var(--shape-c) 0, transparent 42%), var(--bg)',
  },
  { id: 'maroon', name: 'Maroon', css: 'linear-gradient(170deg, var(--mar-1) 0%, var(--mar-2) 45%, var(--mar-3) 100%)' },
]

const MODELS = [
  { name: 'AOI General', tag: 'Default', desc: 'Balanced answers for everyday questions' },
  { name: 'AOI Policy', tag: 'Strict', desc: 'Citation-first answers from official documents' },
  { name: 'AOI STEM Deep', tag: 'Reasoning', desc: 'Step-by-step help on harder problems' },
  { name: 'AOI STEM Fast', tag: 'Quick', desc: 'Short, fast answers for STEM questions' },
]

type Chat = { id: number; title: string; msgs: Msg[]; updated: number }

const DAY = 86_400_000
const SEED_CHATS = (): Chat[] => {
  const now = Date.now()
  return [
    {
      id: now - 2 * DAY,
      title: 'Enrollment requirements',
      updated: now - 2 * DAY,
      msgs: [
        { id: 1, role: 'user', text: 'What are the enrollment requirements for freshmen?', time: '9:12 AM' },
        {
          id: 2,
          role: 'aoi',
          text: 'Freshmen applicants must submit a Form 138, a certificate of good moral character, a PSA birth certificate, and two 2×2 photos.',
          sources: ['Student Handbook p.12', 'Registrar Memo 2025-04'],
          time: '9:12 AM',
        },
      ],
    },
    {
      id: now - 3 * DAY,
      title: 'Scholarship comparison',
      updated: now - 3 * DAY,
      msgs: [
        { id: 1, role: 'user', text: 'Compare scholarship programs for state universities', time: '2:40 PM' },
        {
          id: 2,
          role: 'aoi',
          text: 'The programs differ mainly in eligibility criteria, award coverage, and renewal conditions. Verify against the original papers.',
          sources: ['Semantic Scholar', 'OpenAlex'],
          external: true,
          time: '2:41 PM',
        },
      ],
    },
  ]
}

const load = <T,>(key: string, fallback: () => T): T => {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback()
  } catch {
    return fallback()
  }
}

const FONT_SIZES = { sm: 13, md: 14, lg: 16 } as const
type Theme = 'system' | 'light' | 'dark'
type Settings = { theme: Theme; fontSize: keyof typeof FONT_SIZES; showTime: boolean; bgId: string; bgDim: number; model: string }
const DEFAULT_SETTINGS: Settings = { theme: 'system', fontSize: 'md', showTime: true, bgId: 'default', bgDim: 35, model: 'AOI General' }

function ActionBtn({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200 ease-in-out hover:bg-t-tint/10 active:scale-90 ${active ? 'text-t-accent' : 'text-t-subtle hover:text-t-fg'}`}
    >
      {children}
    </button>
  )
}

const ico = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const


type Tag = 'Research' | 'Policy' | 'Study' | 'Campus'
const TAG_ICONS: Record<Tag, React.ReactElement> = {
  Research: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2M8.5 11h5M11 8.5v5" />
    </>
  ),
  Policy: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  Study: (
    <>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11.5V16c0 1.2 2.7 3 6 3s6-1.8 6-3v-4.5" />
    </>
  ),
  Campus: (
    <>
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
      <path d="M10 21h4" />
    </>
  ),
}
const SUGGESTION_POOL: { tag: Tag; title: string; hint: string; prompt: string }[] = [
  { tag: 'Research', title: 'Literature review kickstart', hint: 'Themes, gaps and key authors in a topic', prompt: 'Help me outline a literature review on the effect of mobile learning on student performance in Philippine state universities, including major themes and research gaps' },
  { tag: 'Research', title: 'Pick a thesis topic', hint: 'Feasible, original ideas for your program', prompt: 'Suggest five feasible undergraduate thesis topics in information technology that use local community data, and explain why each is original' },
  { tag: 'Research', title: 'Qualitative vs. quantitative', hint: 'Choose a method that fits your question', prompt: 'Compare qualitative and quantitative research designs and recommend which fits a study on student stress during enrollment' },
  { tag: 'Research', title: 'Write a strong abstract', hint: 'Structure, length and common mistakes', prompt: 'What are the essential parts of a strong 250-word research abstract, and what mistakes should I avoid?' },
  { tag: 'Policy', title: 'Enrollment requirements', hint: 'Documents and steps for new students', prompt: 'What are the enrollment requirements for new students?' },
  { tag: 'Policy', title: 'Scholarship eligibility', hint: 'Grades, forms and deadlines to watch', prompt: 'What are the scholarship eligibility rules and application deadlines?' },
  { tag: 'Policy', title: 'Shifting programs', hint: 'Who may shift and what gets credited', prompt: 'What is the university policy on shifting to a different program?' },
  { tag: 'Policy', title: 'Leave of absence rules', hint: 'How to file and when you must return', prompt: 'What is the policy for filing a leave of absence and returning to classes?' },
  { tag: 'Study', title: 'Explain RAG simply', hint: 'Retrieval-augmented generation in plain words', prompt: 'What is RAG and why does it make AI answers more reliable?' },
  { tag: 'Study', title: 'Build a 2-week study plan', hint: 'Spaced practice for midterms', prompt: 'Create a two-week study plan for my midterms using spaced repetition and active recall' },
  { tag: 'Study', title: 'APA 7 citation cheat sheet', hint: 'Books, journals and websites', prompt: 'Give me a quick APA 7th edition citation guide for books, journal articles and websites with examples' },
  { tag: 'Study', title: 'Learn statistics intuitively', hint: 'p-values, sampling and effect size', prompt: 'Explain p-values, sampling error and effect size using simple classroom examples' },
  { tag: 'Campus', title: 'Beat procrastination', hint: 'Practical habits for busy students', prompt: 'Give me evidence-based habits to stop procrastinating on papers and projects' },
  { tag: 'Campus', title: 'Prepare for a defense', hint: 'Likely panel questions and delivery tips', prompt: 'How do I prepare for a thesis defense, and what questions will the panel likely ask?' },
  { tag: 'Campus', title: 'Write a formal email to a professor', hint: 'Tone, structure and a ready template', prompt: 'Help me write a respectful email asking my professor for a deadline extension' },
  { tag: 'Campus', title: 'Career paths after graduation', hint: 'Jobs, licensure and further study', prompt: 'What career paths, licensure exams and graduate studies are open after an information technology degree?' },
]
function pickSuggestions() {
  const tags: Tag[] = ['Research', 'Policy', 'Study', 'Campus']
  const picked = tags
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((t) => {
      const g = SUGGESTION_POOL.filter((x) => x.tag === t)
      return g[Math.floor(Math.random() * g.length)]
    })
  return picked
}

function Reveal({ text, onTick, onDone }: { text: string; onTick: () => void; onDone: () => void }) {
  const words = useMemo(() => text.split(/(\s+)/), [text])
  const [n, setN] = useState(0)
  useEffect(() => {
    if (n >= words.length) {
      onDone()
      return
    }
    const t = window.setTimeout(() => {
      setN((x) => Math.min(words.length, x + 2))
      onTick()
    }, 22)
    return () => clearTimeout(t)
  }, [n, words.length])
  return (
    <>
      {words.slice(0, n).join('')}
      {n < words.length && <span className="aoi-caret" aria-hidden />}
    </>
  )
}

function useMedia(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

export default function App() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<'idle' | 'processing' | 'responding' | 'error'>('idle')
  const [listening, setListening] = useState(false)
  const [degraded, setDegraded] = useState(false)
  const [pending, setPending] = useState<{ text: string; rewritten: string } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const idRef = useRef(1)
  const endRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const [attached, setAttached] = useState<string[]>([])
  const [chats, setChats] = useState<Chat[]>(() => load('aoi.chats', SEED_CHATS))
  const [activeId, setActiveId] = useState(() => Date.now())
  const [search, setSearch] = useState('')
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...load<Partial<Settings>>('aoi.settings', () => ({})) }))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [customBg, setCustomBg] = useState<string | null>(() => {
    try {
      return localStorage.getItem('aoi.bgimg')
    } catch {
      return null
    }
  })
  const [bgError, setBgError] = useState('')
  const bgFileRef = useRef<HTMLInputElement>(null)
  const pickBgImage = (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setBgError('Please choose an image file.')
      return
    }
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      const data = c.toDataURL('image/jpeg', 0.82)
      try {
        localStorage.setItem('aoi.bgimg', data)
      } catch {
        setBgError('That image is too large to save on this device. Try a smaller one.')
        return
      }
      setBgError('')
      setCustomBg(data)
      setSettings((x) => ({ ...x, bgId: 'custom' }))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setBgError('Could not read that image.')
    }
    img.src = url
  }
  const removeBgImage = () => {
    try {
      localStorage.removeItem('aoi.bgimg')
    } catch {}
    setCustomBg(null)
    setBgError('')
    setSettings((x) => (x.bgId === 'custom' ? { ...x, bgId: 'default' } : x))
  }
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [atBottom, setAtBottom] = useState(true)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs, phase])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const avatarState: AvatarState =
    phase === 'processing'
      ? 'processing'
      : phase === 'responding'
        ? 'responding'
        : phase === 'error'
          ? 'error'
          : listening
            ? 'listening'
            : degraded
              ? 'degraded'
              : 'idle'

  const buildReply = (route: Route): Omit<Msg, 'id' | 'role' | 'time'> => {
    let reply: Omit<Msg, 'id' | 'role' | 'time'>
    if (route === 'homework') {
      reply = { text: "I can't help with homework completion. I'm here for policy, research, and general learning questions." }
    } else if (route === 'policy') {
      reply = {
        text: 'Freshmen applicants must submit a Form 138, a certificate of good moral character, a PSA birth certificate, and two 2×2 photos. Enrollment follows the registrar’s published schedule, and tuition is assessed per unit once your load is approved by the dean.',
        sources: ['Student Handbook p.12', 'Registrar Memo 2025-04'],
      }
    } else if (route === 'research') {
      reply = {
        text: 'Here is a short synthesis from published literature: the programs differ mainly in eligibility criteria, award coverage, and renewal conditions. Studies on need-based aid in Philippine state universities report higher retention when stipends are paired with academic advising. Treat this as a starting point and verify against the original papers.',
        sources: ['Semantic Scholar', 'OpenAlex'],
      }
    } else {
      reply = {
        text: 'Happy to help. Could you tell me a bit more about what you’re looking for? I can answer questions on university policies, find research on a topic, or point you to campus services.',
      }
    }
    if (degraded) return { text: reply.text, warn: route !== 'homework' }
    return reply
  }

  const deliver = (text: string, route: Route) => {
    setMsgs((m) => [...m, { id: idRef.current++, role: 'user', text, time: stamp(), files: attached.length ? attached : undefined }])
    setAttached([])
    setPhase('processing')
    later(() => {
      if (/\berror\b/i.test(text)) {
        setPhase('error')
        setMsgs((m) => [
          ...m,
          { id: idRef.current++, role: 'aoi', text: 'Sorry, something went wrong while handling that request. Please try again.', time: stamp() },
        ])
        later(() => setPhase('idle'), 2000)
        return
      }
      setPhase('responding')
      later(() => {
        setMsgs((m) => [...m, { id: idRef.current++, role: 'aoi', external: route === 'research', time: stamp(), ...buildReply(route) }])
        later(() => setPhase('idle'), 1000)
      }, 600)
    }, 1500)
  }

  const send = (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || phase === 'processing' || phase === 'responding') return
    if (override === undefined) setInput('')
    setListening(false)
    const route = classify(text)
    if (route === 'research') {
      setPhase('idle')
      setShowPreview(false)
      setPending({ text, rewritten: anonymize(text) })
      return
    }
    deliver(text, route)
  }

  const confirm = () => {
    if (!pending) return
    const { text } = pending
    setPending(null)
    deliver(text, 'research')
  }

  const cancel = () => {
    if (pending) setInput(pending.text)
    setPending(null)
    setPhase('idle')
  }

  const busy = phase === 'processing' || phase === 'responding'
  const empty = msgs.length === 0
  const [emptyVisible, setEmptyVisible] = useState(true)
  const [ideas, setIdeas] = useState(pickSuggestions)
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    if (!empty && emptyVisible) {
      const t = window.setTimeout(() => setEmptyVisible(false), 250)
      return () => clearTimeout(t)
    }
  }, [empty, emptyVisible])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const isDesktop = useMedia('(min-width: 1024px)')
  const isWide = useMedia('(min-width: 768px)')
  useEffect(() => {
    if (isDesktop) setDrawerOpen(false)
  }, [isDesktop])
  const [sheetOpen, setSheetOpen] = useState(false)
  const sysDark = useMedia('(prefers-color-scheme: dark)')
  const resolved = settings.theme === 'system' ? (sysDark ? 'dark' : 'light') : settings.theme
  const themeInit = useRef(true)
  useEffect(() => {
    const el = document.documentElement
    if (!themeInit.current) {
      el.classList.add('theme-anim')
      const t = window.setTimeout(() => el.classList.remove('theme-anim'), 400)
      el.dataset.theme = resolved
      return () => clearTimeout(t)
    }
    themeInit.current = false
    el.dataset.theme = resolved
  }, [resolved])
  const seenRef = useRef<number>(msgs.length ? msgs[msgs.length - 1].id : -1)
  const [revealId, setRevealId] = useState<number | null>(null)
  useEffect(() => {
    const last = msgs[msgs.length - 1]
    if (!last || last.role !== 'aoi') return
    if (last.id !== seenRef.current) {
      seenRef.current = last.id
      if (phase === 'responding' || phase === 'error') setRevealId(last.id)
    }
  }, [msgs])
  const follow = () => {
    const t = mainRef.current
    if (t && t.scrollHeight - t.scrollTop - t.clientHeight < 160) endRef.current?.scrollIntoView({ block: 'end' })
  }
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const { model, bgId } = settings
  const setModel = (m: string) => setSettings((x) => ({ ...x, model: m }))
  const setBgId = (b: string) => setSettings((x) => ({ ...x, bgId: b }))
  const dim = settings.bgDim / 100
  const bg =
    bgId === 'custom' && customBg
      ? { id: 'custom', name: 'Photo', css: `linear-gradient(rgba(0,0,0,${dim}),rgba(0,0,0,${dim})), url(${customBg}) center / cover no-repeat` }
      : (BACKGROUNDS.find((b) => b.id === bgId) ?? BACKGROUNDS[0])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        newChat()
        inputRef.current?.focus()
      } else if (e.key === '/' && !typing && !pending && !settingsOpen) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const settingsReturn = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (settingsOpen) {
      settingsReturn.current = document.activeElement as HTMLElement
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-label="Settings"] button')?.focus())
    } else settingsReturn.current?.focus?.()
  }, [settingsOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false)
        setModelOpen(false)
        setSheetOpen(false)
        setSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const resetTransient = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setInput('')
    setAttached([])
    setPhase('idle')
    setPending(null)
    setListening(false)
    setDrawerOpen(false)
  }

  const stop = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setPhase('idle')
  }

  const selectChat = (id: number) => {
    const c = chats.find((x) => x.id === id)
    if (!c) return
    resetTransient()
    idRef.current = Math.max(idRef.current, ...c.msgs.map((m) => m.id)) + 1
    setMsgs(c.msgs)
    setActiveId(id)
  }

  const deleteChat = (id: number) => {
    setChats((cs) => cs.filter((c) => c.id !== id))
    if (id === activeId) newChat()
  }

  const exportChat = () => {
    const title = chats.find((c) => c.id === activeId)?.title ?? 'AOI conversation'
    const body = msgs
      .map((m) => `[${m.time}] ${m.role === 'user' ? 'You' : 'AOI'}: ${m.text}${m.sources ? `\n  Sources: ${m.sources.join(', ')}` : ''}`)
      .join('\n\n')
    const url = URL.createObjectURL(new Blob([`${title}\n${'='.repeat(title.length)}\n\n${body}\n`], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^\w-]+/g, '-').toLowerCase() || 'chat'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearAll = () => {
    setChats([])
    newChat()
    setSettingsOpen(false)
  }

  const regenerate = () => {
    if (busy) return
    const idx = msgs.map((m) => m.role).lastIndexOf('user')
    if (idx < 0) return
    const text = msgs[idx].text
    setMsgs(msgs.slice(0, idx))
    send(text)
  }

  const copyMsg = (m: Msg) => {
    navigator.clipboard?.writeText(m.text).catch(() => {})
    setCopiedId(m.id)
    window.setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1500)
  }

  const rate = (id: number, r: 'up' | 'down') =>
    setMsgs((ms) => ms.map((m) => (m.id === id ? { ...m, rating: m.rating === r ? undefined : r } : m)))

  useEffect(() => {
    if (!msgs.length) return
    const first = msgs.find((m) => m.role === 'user')?.text ?? 'New chat'
    const title = first.length > 34 ? first.slice(0, 34).trimEnd() + '…' : first
    setChats((cs) => {
      const next = { id: activeId, title, msgs, updated: Date.now() }
      const i = cs.findIndex((c) => c.id === activeId)
      if (i < 0) return [next, ...cs]
      const copy = [...cs]
      copy[i] = next
      return copy
    })
  }, [msgs])

  useEffect(() => {
    try {
      localStorage.setItem('aoi.chats', JSON.stringify(chats))
    } catch {}
  }, [chats])
  useEffect(() => {
    try {
      localStorage.setItem('aoi.settings', JSON.stringify(settings))
    } catch {}
  }, [settings])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }, [input])

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR || !listening) return
    const r = new SR()
    r.continuous = true
    r.interimResults = false
    r.lang = 'en-US'
    r.onresult = (e: any) => {
      let t = ''
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript
      setInput((p) => (p ? p + ' ' : '') + t.trim())
    }
    r.onerror = () => setListening(false)
    try {
      r.start()
    } catch {}
    return () => {
      r.onresult = null
      r.onerror = null
      try {
        r.stop()
      } catch {}
    }
  }, [listening])

  const newChat = () => {
    setIdeas(pickSuggestions())
    timers.current.forEach(clearTimeout)
    timers.current = []
    setActiveId(Date.now())
    setAttached([])
    setMsgs([])
    setInput('')
    setPhase('idle')
    setPending(null)
    setListening(false)
    setEmptyVisible(true)
    setDrawerOpen(false)
  }

  return (
    <div
      className="relative mx-auto flex h-full w-full max-w-[430px] overflow-hidden pl-[var(--sa-left)] pr-[var(--sa-right)] md:max-w-none text-t-fg transition-[background] duration-300"
      style={{ background: bg.css }}
      onTouchStart={(e) => {
        const t = e.touches[0]
        swipe.current = { x: t.clientX, y: t.clientY }
      }}
      onTouchEnd={(e) => {
        const s0 = swipe.current
        swipe.current = null
        if (!s0 || isDesktop) return
        const t = e.changedTouches[0]
        const dx = t.clientX - s0.x
        const dy = Math.abs(t.clientY - s0.y)
        if (dy > 50 || Math.abs(dx) < 70) return
        if (!drawerOpen && dx > 0 && s0.x < 40) setDrawerOpen(true)
        else if (drawerOpen && dx < 0) setDrawerOpen(false)
      }}
    >
      <div className={`absolute inset-0 z-50 lg:pointer-events-auto lg:relative lg:inset-auto lg:z-auto lg:w-[300px] lg:shrink-0 ${drawerOpen ? '' : 'pointer-events-none'}`} aria-hidden={!drawerOpen && !isDesktop}>
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity lg:hidden duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <aside
          inert={!drawerOpen && !isDesktop}
          aria-label="Navigation"
          className={`absolute inset-y-0 left-0 flex w-[84%] max-w-[320px] flex-col lg:w-full lg:max-w-none lg:translate-x-0 lg:shadow-none border-r border-t-surface bg-t-deep text-t-fg shadow-[8px_0_32px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex items-center justify-between px-5 pb-3 pt-[calc(1rem+var(--sa-top))]">
            <span className="flex items-center gap-1 text-[20px] font-extrabold tracking-tight">
              AOI
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#B01E2E]" />
            </span>
            <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={resolved === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={() => setSettings((x) => ({ ...x, theme: resolved === 'dark' ? 'light' : 'dark' }))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-t-muted transition-all duration-200 ease-in-out hover:bg-t-tint/10 hover:text-t-fg active:scale-90"
            >
              {resolved === 'dark' ? (
                <svg {...ico} width={19} height={19}>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg {...ico} width={19} height={19}>
                  <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-full text-t-muted transition-colors duration-200 ease-in-out hover:bg-t-tint/10 hover:text-t-fg"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
            </div>
          </div>

          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={newChat}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[12px] font-semibold text-white shadow-[0_0_15px_rgba(128,0,0,0.4)] transition-all duration-200 ease-in-out hover:brightness-125 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #800000, #600000)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Chat
            </button>
          </div>

          <div className="px-4 pb-1">
            <label className="flex h-10 items-center gap-2 rounded-[12px] border border-t-surface bg-t-input px-3 transition-colors duration-200 ease-in-out focus-within:border-[#800000]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--subtle)" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-t-fg outline-none placeholder:text-t-subtle"
              />
            </label>
          </div>

          <nav className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {(() => {
              const list = [...chats].filter((c) => c.title.toLowerCase().includes(search.toLowerCase())).sort((x, y) => y.updated - x.updated)
              const today = list.filter((c) => Date.now() - c.updated < DAY)
              const older = list.filter((c) => Date.now() - c.updated >= DAY)
              const groups = [
                { label: 'Recent Chats', items: today },
                { label: 'Previous 7 Days', items: older },
              ].filter((g) => g.items.length)
              if (!groups.length) return <p className="px-3 pt-6 text-center text-[13px] text-t-subtle">{search ? 'No chats match your search.' : 'No conversations yet.'}</p>
              return groups.map((g) => (
                <div key={g.label} className="mt-3">
                  <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-t-muted">{g.label}</p>
                  {g.items.map((c) => (
                    <div
                      key={c.id}
                      className={`group flex items-center rounded-[10px] transition-colors duration-200 ease-in-out hover:bg-t-surface ${c.id === activeId ? 'bg-t-surface' : ''}`}
                    >
                      <button type="button" onClick={() => selectChat(c.id)} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left text-[14px]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                          <path d="M21 12a8 8 0 0 1-11.7 7.1L3 21l1.9-6.3A8 8 0 1 1 21 12z" />
                        </svg>
                        <span className="truncate">{c.title}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${c.title}`}
                        onClick={() => deleteChat(c.id)}
                        className="mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-t-subtle opacity-0 transition-all duration-200 ease-in-out hover:bg-t-tint/10 hover:text-t-accent focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      >
                        <svg {...ico}>
                          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ))
            })()}
          </nav>

          <div className="border-t border-t-line p-3 pb-[calc(0.75rem+var(--sa-bottom))]">
            <button type="button" onClick={() => { setSettingsOpen(true); setDrawerOpen(false) }} className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[14px] transition-colors duration-200 ease-in-out hover:bg-t-surface">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
              Settings
            </button>
            <button type="button" className="mt-0.5 flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors duration-200 ease-in-out hover:bg-t-surface">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#800000] text-[12px] font-bold text-white">JD</span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium">Juan Dela Cruz</span>
                <span className="block text-[12px] text-t-muted">Account · Student</span>
              </span>
            </button>
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
      <header
        className={`relative z-30 grid h-[calc(3.5rem+var(--sa-top))] shrink-0 pt-[var(--sa-top)] grid-cols-[1fr_auto_1fr] items-center border-b px-3 md:px-6 lg:flex lg:justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-colors duration-300 ease-in-out ${degraded ? 'border-[#92400E] bg-[#B45309] text-white' : 'border-t-line bg-t-surface text-t-fg'}`}
      >
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="lg:hidden flex h-10 w-10 items-center justify-center justify-self-start rounded-full transition-colors duration-200 ease-in-out hover:bg-t-tint/10 active:bg-t-tint/10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={modelOpen}
            onClick={() => setModelOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] font-semibold transition-colors duration-200 ease-in-out hover:bg-t-tint/10"
          >
            {model}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${modelOpen ? 'rotate-180' : ''}`} aria-hidden>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {modelOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setModelOpen(false)} />
              <div
                role="menu"
                className="aoi-menu absolute left-1/2 top-full z-50 mt-2 w-[264px] -translate-x-1/2 lg:left-0 lg:translate-x-0 rounded-2xl border border-t-line bg-t-surface p-1.5 text-t-fg shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
              >
                {MODELS.map((m) => (
                  <button
                    key={m.name}
                    type="button"
                    role="menuitemradio"
                    aria-checked={model === m.name}
                    onClick={() => {
                      setModel(m.name)
                      setModelOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 ease-in-out hover:bg-t-tint/10 ${model === m.name ? 'bg-t-tint/5' : ''}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[14px] font-semibold">
                        {m.name}
                        <span className="rounded-full bg-[#800000]/40 px-1.5 py-px text-[10px] font-medium text-t-accent">{m.tag}</span>
                      </span>
                      <span className="mt-0.5 block text-[12px] text-t-muted">{m.desc}</span>
                    </span>
                    {model === m.name && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            aria-label="Chat background"
            onClick={() => setSheetOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-t-soft transition-all duration-200 ease-in-out hover:bg-t-tint/10 hover:text-t-fg active:scale-90"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-3.9-4-7.2-9-7.2z" />
              <circle cx="7.5" cy="11" r="1" fill="currentColor" />
              <circle cx="10.5" cy="7" r="1" fill="currentColor" />
              <circle cx="15.5" cy="7.5" r="1" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={degraded}
            aria-label="Demo: toggle degraded mode"
            title="Demo: degraded mode"
            onClick={() => setDegraded((d) => !d)}
            className="relative h-3.5 w-6 rounded-full bg-t-tint/20 opacity-60 transition-all hover:opacity-100 focus-visible:opacity-100"
          >
            <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${degraded ? 'left-[12px]' : 'left-0.5'}`} />
          </button>
          <Avatar state={avatarState} width={32} variant="face" />
        </div>
      </header>

      <div
        className="grid shrink-0 transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: degraded ? '1fr' : '0fr' }}
        aria-hidden={!degraded}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className="px-5 py-2 text-[12px] leading-snug text-t-fg"
            style={{ background: 'repeating-linear-gradient(135deg, #B45309 0 10px, #A14808 10px 20px)' }}
          >
            ⚠ Degraded mode: running on local fallback. Answers may be slower and may not cite sources.
          </div>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <main
          ref={mainRef}
          onScroll={(e) => {
            const t = e.currentTarget
            setAtBottom(t.scrollHeight - t.scrollTop - t.clientHeight < 80)
          }}
          className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6"
        >
          {emptyVisible && (
            <div className={`absolute inset-0 flex flex-col items-center px-4 pb-3 text-center ${empty ? 'aoi-fade-in' : 'aoi-fade-out pointer-events-none'}`}>
              <div className="flex flex-1 flex-col items-center justify-center pt-10">
                <div className="relative">
                  <span
                    className="aoi-breathe absolute -inset-20 rounded-full blur-xl"
                    style={{ background: 'radial-gradient(circle at 30% 35%, rgba(56,189,248,0.45) 0%, transparent 55%), radial-gradient(circle at 72% 70%, rgba(176,30,46,0.55) 0%, transparent 58%)' }}
                  />
                  <span
                    className="absolute -inset-6 rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(125,211,252,0.18) 0%, transparent 70%)' }}
                  />
                  <Avatar state={avatarState} width={isWide ? 200 : 140} />
                </div>
                <h1 className="relative mt-6 max-w-[260px] text-[22px] md:mt-8 md:max-w-[480px] md:text-[30px] font-bold leading-snug tracking-tight text-t-fg">
                  Hi, I’m AOI. How can I help you today?
                </h1>
              </div>
              <div className="grid w-full max-w-[760px] grid-cols-1 gap-2.5 md:grid-cols-3 md:gap-3">
                {ideas.map((s, i) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => {
                      setInput(s.prompt)
                      inputRef.current?.focus()
                    }}
                    style={{ animationDelay: `${0.1 + i * 0.08}s` }}
                    className="aoi-in group flex items-center gap-3 rounded-2xl border border-t-tint/10 bg-t-surface/60 px-4 py-3 text-left shadow-[0_6px_20px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-[#800000] hover:bg-[#800000]/15 active:scale-[0.98] md:flex-col md:items-start md:gap-2 md:p-4"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#800000]/30 text-t-accent transition-colors duration-200 ease-in-out group-hover:bg-[#800000]/60 group-hover:text-t-fg">
                      <svg {...ico} width={18} height={18}>
                        {TAG_ICONS[s.tag]}
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-t-accent">{s.tag}</span>
                      <span className="mt-0.5 block text-[13px] font-semibold text-t-fg">{s.title}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-t-muted">{s.hint}</span>
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIdeas(pickSuggestions())}
                  className="col-span-full mx-auto mt-1 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-t-muted transition-all duration-200 ease-in-out hover:bg-t-tint/10 hover:text-t-fg active:scale-95"
                >
                  <svg {...ico} width={14} height={14}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
                  Shuffle ideas
                </button>
              </div>
            </div>
          )}
          {!empty && (
            <div role="log" aria-live="polite" className="aoi-fade-in-delay mx-auto flex w-full max-w-[800px] flex-col gap-6 py-2" style={{ fontSize: FONT_SIZES[settings.fontSize] }}>
              <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[1px] text-t-subtle">
                <span className="h-px flex-1 bg-t-tint/10" />
                {new Date(activeId).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                <span className="h-px flex-1 bg-t-tint/10" />
              </div>
              {msgs.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="aoi-in flex flex-col items-end gap-1">
                    {m.files && (
                      <div className="flex max-w-[80%] flex-wrap justify-end gap-1.5">
                        {m.files.map((f) => (
                          <span key={f} className="flex items-center gap-1.5 rounded-lg border border-t-tint/10 bg-t-surface/80 px-2.5 py-1.5 text-[12px] text-t-soft">
                            <svg {...ico} width={13} height={13}>
                              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                              <path d="M14 3v5h5" />
                            </svg>
                            <span className="max-w-[160px] truncate">{f}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <div
                      className="max-w-[80%] rounded-[20px] rounded-br-[4px] px-4 py-3 leading-relaxed text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_16px_rgba(74,0,0,0.45)] [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]"
                      style={{ background: 'linear-gradient(135deg, #800000 0%, #4a0000 100%)' }}
                    >
                      {m.text}
                    </div>
                    {settings.showTime && <span className="px-1 text-[10px] font-medium uppercase tracking-[0.5px] text-t-subtle">{m.time}</span>}
                  </div>
                ) : (
                  <div key={m.id} className="aoi-in flex max-w-[92%] items-start gap-2.5 md:max-w-[88%]">
                    <div className="mt-0.5 shrink-0">
                      <Avatar state="idle" width={30} variant="face" />
                    </div>
                    <div className="flex min-w-0 flex-col items-start gap-1">
                    <span className="px-1 text-[11px] font-semibold tracking-wide text-t-soft">AOI</span>
                    <div className="rounded-[20px] rounded-bl-[4px] border border-t-tint/10 bg-t-surface/80 px-4 py-3 leading-relaxed text-t-fg shadow-[0_6px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[10px]">
                      {m.id === revealId ? <Reveal text={m.text} onTick={follow} onDone={() => setRevealId(null)} /> : m.text}
                    </div>
                    <div className={`flex items-center gap-0.5 ${m.id === revealId ? 'invisible' : 'aoi-fade-in'}`}>
                      {settings.showTime && <span className="px-1 text-[10px] font-medium uppercase tracking-[0.5px] text-t-subtle">{m.time}</span>}
                      <ActionBtn label={copiedId === m.id ? 'Copied' : 'Copy'} active={copiedId === m.id} onClick={() => copyMsg(m)}>
                        {copiedId === m.id ? (
                          <svg {...ico}><path d="m5 12 5 5L20 7" /></svg>
                        ) : (
                          <svg {...ico}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
                        )}
                      </ActionBtn>
                      <ActionBtn label="Good response" active={m.rating === 'up'} onClick={() => rate(m.id, 'up')}>
                        <svg {...ico} fill={m.rating === 'up' ? 'currentColor' : 'none'}><path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2.3l-1.2 6.5a2 2 0 0 1-2 1.7H7" /></svg>
                      </ActionBtn>
                      <ActionBtn label="Bad response" active={m.rating === 'down'} onClick={() => rate(m.id, 'down')}>
                        <svg {...ico} fill={m.rating === 'down' ? 'currentColor' : 'none'}><path d="M17 13V4h3v9zM17 13l-4 8a2 2 0 0 1-2-2v-4H5a2 2 0 0 1-2-2.3l1.2-6.5A2 2 0 0 1 6.2 4H17" /></svg>
                      </ActionBtn>
                      {m.id === msgs[msgs.length - 1].id && !busy && (
                        <ActionBtn label="Regenerate" onClick={regenerate}>
                          <svg {...ico}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
                        </ActionBtn>
                      )}
                    </div>
                    {m.sources && m.id !== revealId && (
                      <div className="aoi-fade-in mt-1 flex flex-wrap items-center gap-1.5">
                        {m.external && <span className="text-[12px] text-t-muted">Sources:</span>}
                        {m.sources.map((s) => (
                          <SourceChip key={s} label={s} external={m.external} />
                        ))}
                      </div>
                    )}
                    {m.warn && m.id !== revealId && <p className="aoi-fade-in mt-1 text-[12px] font-medium text-t-warn">⚠ No sources available in degraded mode.</p>}
                    </div>
                  </div>
                ),
              )}
              {(phase === 'processing' || phase === 'responding') && (
                <div className="aoi-in flex items-start gap-2.5" aria-label="AOI is thinking">
                  <div className="mt-0.5 shrink-0">
                    <Avatar state={avatarState} width={30} variant="face" />
                  </div>
                  <div className="flex flex-col items-start gap-1.5">
                  <span className="aoi-shimmer px-1 text-[12px] font-medium tracking-wide text-t-muted">Thinking...</span>
                  <div className="flex gap-1.5 rounded-[20px] rounded-bl-[4px] border border-t-tint/10 bg-t-surface/80 px-4 py-4 backdrop-blur-[10px]">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="aoi-dot h-2 w-2 rounded-full bg-t-muted" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={endRef} />
        </main>
        {!empty && !atBottom && (
          <button
            type="button"
            aria-label="Scroll to latest message"
            onClick={() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
            className="aoi-in absolute bottom-3 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-t-tint/10 bg-t-surface/90 text-t-fg shadow-[0_6px_16px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-200 ease-in-out hover:border-[#800000]"
          >
            <svg {...ico} width={18} height={18}><path d="M12 5v14M5 12l7 7 7-7" /></svg>
          </button>
        )}
      </div>

      <footer
        className="shrink-0 px-3 pt-2 md:px-6"
        style={{ paddingBottom: 'calc(12px + var(--sa-bottom))' }}
      >
        {attached.length > 0 && (
          <div className="mx-auto mb-2 flex max-w-[800px] flex-wrap gap-1.5">
            {attached.map((f) => (
              <span key={f} className="aoi-in flex items-center gap-1.5 rounded-full border border-t-tint/10 bg-t-surface/80 py-1 pl-3 pr-1.5 text-[12px] text-t-soft">
                <span className="max-w-[180px] truncate">{f}</span>
                <button type="button" aria-label={`Remove ${f}`} onClick={() => setAttached((a) => a.filter((x) => x !== f))} className="flex h-5 w-5 items-center justify-center rounded-full text-t-muted transition-colors duration-200 ease-in-out hover:bg-t-tint/10 hover:text-t-fg">
                  <svg {...ico} width={12} height={12}><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const names = Array.from(e.target.files ?? []).map((f) => f.name)
            setAttached((a) => [...a, ...names.filter((n) => !a.includes(n))].slice(0, 4))
            e.target.value = ''
          }}
        />
        {listening && <p className="mx-auto mb-2 max-w-[800px] text-center text-[12px] font-medium text-t-accent">Listening… tap the mic to stop</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setPressed(true)
            navigator.vibrate?.(8)
            send()
          }}
          className="mx-auto flex w-full max-w-[800px] items-end gap-0.5 rounded-[24px] border border-t-tint/10 bg-t-surface/60 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[16px] transition-all duration-200 ease-in-out focus-within:border-[#800000] focus-within:shadow-[0_10px_30px_rgba(0,0,0,0.45),0_0_0_1px_#800000,0_0_18px_rgba(128,0,0,0.45)]"
        >
          <button
            type="button"
            aria-label="Attach file"
            onClick={() => fileRef.current?.click()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-t-muted transition-colors duration-200 ease-in-out hover:bg-t-tint/10 hover:text-t-fg active:bg-t-tint/10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m21.4 11.6-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.5a1.8 1.8 0 0 1-2.6-2.6l7.9-7.8" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                if (!busy) {
                  setPressed(true)
            navigator.vibrate?.(8)
                  send()
                }
              }
            }}
            placeholder="Message AOI…"
            className="max-h-[140px] min-w-0 flex-1 resize-none self-center bg-transparent px-1.5 py-1 text-[14px] leading-snug text-t-fg outline-none placeholder:text-t-muted"
          />
          <button
            type="button"
            aria-label="Voice input"
            aria-pressed={listening}
            onClick={() => setListening((l) => !l)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ease-in-out ${listening ? 'bg-[#800000] text-white' : 'text-t-fg hover:bg-t-tint/10 active:bg-t-tint/10'}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <path d="M12 18v4" />
            </svg>
          </button>
          {busy ? (
            <button
              type="button"
              aria-label="Stop generating"
              onClick={stop}
              className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full border border-[#800000] bg-[#800000]/20 text-t-accent shadow-[0_0_16px_rgba(128,0,0,0.5)] transition-all duration-200 ease-in-out hover:bg-[#800000]/40 active:scale-90"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="3" /></svg>
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Send"
              disabled={!input.trim()}
              className={`flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full text-white shadow-[0_0_16px_rgba(128,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all duration-200 ease-in-out hover:brightness-125 disabled:opacity-40 disabled:shadow-none ${pressed ? 'aoi-press' : ''}`}
              style={{ background: 'linear-gradient(135deg, #800000, #600000)' }}
              onAnimationEnd={() => setPressed(false)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5" />
                <path d="m5 12 7-7 7 7" />
              </svg>
            </button>
          )}
        </form>
        <p className="mx-auto mt-2 hidden max-w-[800px] text-center text-[11px] text-t-subtle md:block">AOI can make mistakes. Verify important information with the registrar.</p>
      </footer>
      </div>

      <div className={`absolute inset-0 z-[60] flex items-end justify-center ${sheetOpen ? '' : 'pointer-events-none'}`} aria-hidden={!sheetOpen}>
        <div
          onClick={() => setSheetOpen(false)}
          className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${sheetOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          inert={!sheetOpen}
          role="dialog"
          aria-label="Chat background"
          className={`relative w-full md:max-w-[480px] rounded-t-[24px] border-t border-t-tint/10 bg-t-deep px-5 pt-3 text-t-fg shadow-[0_-12px_40px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${sheetOpen ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ paddingBottom: 'calc(20px + var(--sa-bottom))' }}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-t-tint/20" />
          <h2 className="text-[16px] font-bold">Chat background</h2>
          <p className="mb-4 mt-0.5 text-[12px] text-t-muted">Pick a look or use your own photo.</p>
          <div className="grid grid-cols-4 gap-3">
            {[...BACKGROUNDS, ...(customBg ? [{ id: 'custom', name: 'Photo', css: `url(${customBg}) center / cover` }] : [])].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBgId(b.id)}
                aria-pressed={bgId === b.id}
                className="group flex flex-col items-center gap-2 transition-transform duration-200 ease-in-out active:scale-95"
              >
                <span
                  className={`relative block h-[84px] w-full rounded-[14px] border-2 transition-all duration-200 ease-in-out ${bgId === b.id ? 'border-[#B01E2E] shadow-[0_0_14px_rgba(128,0,0,0.6)]' : 'border-t-line group-hover:border-t-subtle'}`}
                  style={{ background: b.css }}
                >
                  {bgId === b.id && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#800000]">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-medium text-t-soft">{b.name}</span>
              </button>
            ))}
          </div>
          <input ref={bgFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickBgImage(e.target.files?.[0]); e.target.value = '' }} />
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => bgFileRef.current?.click()}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] border border-[#800000] bg-[#800000]/20 text-[14px] font-semibold text-t-accent transition-all duration-200 ease-in-out hover:bg-[#800000]/40 active:scale-[0.98]"
            >
              <svg {...ico} width={18} height={18}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="1.8" /><path d="m21 15-5-5L5 21" /></svg>
              {customBg ? 'Change photo' : 'Upload your own photo'}
            </button>
            {customBg && (
              <button type="button" onClick={removeBgImage} className="h-11 rounded-[12px] border border-t-line2 bg-t-line px-4 text-[14px] font-semibold transition-all duration-200 ease-in-out hover:brightness-95 active:scale-[0.98]">
                Remove
              </button>
            )}
          </div>
          {bgError && <p className="mt-2 text-[12px] font-medium text-t-warn">{bgError}</p>}
          {bgId === 'custom' && customBg && (
            <label className="mt-4 block">
              <span className="flex justify-between text-[12px] font-medium text-t-soft"><span>Dim for readability</span><span>{settings.bgDim}%</span></span>
              <input
                type="range"
                min={0}
                max={80}
                value={settings.bgDim}
                onChange={(e) => setSettings((x) => ({ ...x, bgDim: Number(e.target.value) }))}
                className="mt-2 w-full accent-[#800000]"
              />
            </label>
          )}
        </div>
      </div>

      {settingsOpen && (
        <div className="aoi-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-5 backdrop-blur-[8px]" role="dialog" aria-modal="true" aria-label="Settings" onClick={() => setSettingsOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="aoi-spring w-full max-w-[380px] rounded-[20px] border border-t-line bg-t-surface p-5 text-t-fg shadow-[0_12px_40px_rgba(0,0,0,0.5)] md:max-w-[440px] md:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-bold">Settings</h2>
              <button type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-t-muted transition-colors duration-200 ease-in-out hover:bg-t-tint/10 hover:text-t-fg">
                <svg {...ico} width={18} height={18}><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>

            <p className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-t-muted">Appearance</p>
            <div className="grid grid-cols-3 gap-2 rounded-[12px] bg-t-bg p-1">
              {(['system', 'light', 'dark'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={settings.theme === k}
                  onClick={() => setSettings((x) => ({ ...x, theme: k }))}
                  className={`rounded-[9px] py-2 text-[14px] font-medium capitalize transition-all duration-200 ease-in-out ${settings.theme === k ? 'bg-[#800000] text-white shadow-[0_0_12px_rgba(128,0,0,0.5)]' : 'text-t-muted hover:text-t-fg'}`}
                >
                  {k}
                </button>
              ))}
            </div>

            <p className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-t-muted">Text size</p>
            <div className="grid grid-cols-3 gap-2 rounded-[12px] bg-t-bg p-1">
              {(['sm', 'md', 'lg'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={settings.fontSize === k}
                  onClick={() => setSettings((x) => ({ ...x, fontSize: k }))}
                  className={`rounded-[9px] py-2 font-medium transition-all duration-200 ease-in-out ${settings.fontSize === k ? 'bg-[#800000] text-white shadow-[0_0_12px_rgba(128,0,0,0.5)]' : 'text-t-muted hover:text-t-fg'}`}
                  style={{ fontSize: FONT_SIZES[k] }}
                >
                  {k === 'sm' ? 'Small' : k === 'md' ? 'Medium' : 'Large'}
                </button>
              ))}
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.showTime}
              onClick={() => setSettings((x) => ({ ...x, showTime: !x.showTime }))}
              className="mt-5 flex w-full items-center justify-between rounded-[12px] px-1 py-1 text-left"
            >
              <span>
                <span className="block text-[14px] font-medium">Show timestamps</span>
                <span className="block text-[12px] text-t-muted">Display the time under each message</span>
              </span>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-in-out ${settings.showTime ? 'bg-[#800000]' : 'bg-t-line'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-200 ease-in-out ${settings.showTime ? 'left-[22px]' : 'left-0.5'}`} />
              </span>
            </button>

            <p className="mt-5 text-[12px] text-t-subtle">Your preferences are saved on this device and restored next time.</p>

            <button
              type="button"
              disabled={!msgs.length}
              onClick={exportChat}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-t-line2 bg-t-line text-[14px] font-semibold transition-all duration-200 ease-in-out hover:brightness-95 active:scale-[0.98] disabled:opacity-40"
            >
              <svg {...ico} width={17} height={17}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>
              Export this chat (.txt)
            </button>
            <div className="mt-2 hidden items-center justify-center gap-3 text-[11px] text-t-subtle md:flex">
              <span><kbd className="rounded border border-t-line px-1">Ctrl</kbd> + <kbd className="rounded border border-t-line px-1">K</kbd> New chat</span>
              <span><kbd className="rounded border border-t-line px-1">/</kbd> Focus message</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setSettings(DEFAULT_SETTINGS)} className="h-11 flex-1 rounded-[12px] border border-t-line2 bg-t-line text-[14px] font-semibold transition-all duration-200 ease-in-out hover:brightness-125 active:scale-[0.98]">
                Reset
              </button>
              <button type="button" onClick={clearAll} className="h-11 flex-1 rounded-[12px] border border-[#800000] bg-[#800000]/20 text-[14px] font-semibold text-t-accent transition-all duration-200 ease-in-out hover:bg-[#800000]/40 active:scale-[0.98]">
                Clear all chats
              </button>
            </div>
          </div>
        </div>
      )}

      {pending && (
        <div className="aoi-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-[8px]" role="dialog" aria-modal="true" aria-labelledby="consent-title">
          <div className="aoi-spring no-scrollbar max-h-[90vh] w-full max-w-[380px] overflow-y-auto md:max-w-[500px] md:p-6 rounded-[20px] border border-t-line bg-t-surface p-5 text-t-fg shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#800000]/30 text-t-accent">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <h2 id="consent-title" className="mt-3 text-[18px] font-bold text-t-fg">
              External Research Query
            </h2>
            <p className="mt-2 leading-relaxed text-t-fg">
              This query may be sent to an external AI provider with identifying information removed. Do you want to continue?
            </p>
            <p className="mt-2 text-[12px] leading-snug text-t-muted">
              Your query will be anonymized. You can review the rewritten prompt before it’s sent.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={confirm}
                className="h-11 rounded-[12px] bg-[#800000] font-semibold text-white transition-all hover:bg-[#6F0000] active:scale-[0.98]"
              >
                Continue
              </button>
              <button type="button" onClick={cancel} className="h-11 rounded-[12px] bg-t-line font-semibold text-t-fg transition-colors duration-200 ease-in-out hover:brightness-95 active:bg-t-line2">
                Cancel
              </button>
            </div>
            <div className="mt-4 border-t border-t-line pt-3">
              <button
                type="button"
                aria-expanded={showPreview}
                onClick={() => setShowPreview((s) => !s)}
                className="flex w-full items-center justify-between text-[12px] font-medium text-t-muted"
              >
                Preview rewritten prompt
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showPreview ? 'rotate-180' : ''}`}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {showPreview && (
                <textarea
                  value={pending.rewritten}
                  onChange={(e) => setPending((p) => (p ? { ...p, rewritten: e.target.value } : p))}
                  rows={4}
                  aria-label="Rewritten prompt"
                  className="mt-2 w-full resize-none rounded-[12px] border border-t-line bg-t-bg p-3 text-[13px] leading-relaxed text-t-fg outline-none focus:border-[#800000]"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
