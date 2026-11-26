import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import msuLogo from './msu-logo.png'
import portalBg from './portal-bg.mp4'

export type Role = 'Student' | 'Faculty' | 'Staff' | 'Admin'
export type View = 'login' | 'account' | 'about' | 'research' | 'portal' | 'chat' | 'audit' | 'aoi'
export type AuditRow = { cid: string; ts: number; role: Role; intent: string; model: string; path: string; external: boolean; wait?: number; user?: string }

export const ROLES: { value: Role; desc: string }[] = [
  { value: 'Student', desc: 'Chat and research · own activity log' },
  { value: 'Faculty', desc: 'Chat and research · own activity log' },
  { value: 'Staff', desc: 'Chat and research · own activity log' },
  { value: 'Admin', desc: 'Full system audit logs across all accounts' },
]

const CID_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'
export const newCid = () => 'aoi-' + Array.from({ length: 5 }, () => CID_CHARS[Math.floor(Math.random() * CID_CHARS.length)]).join('')
export const legacyCid = (a: number, b: number) => {
  let h = (a * 31 + b * 17) >>> 0
  let s = ''
  for (let i = 0; i < 5; i++) {
    s += CID_CHARS[h % CID_CHARS.length]
    h = Math.floor(h / CID_CHARS.length) + 7919 * (i + 1)
  }
  return 'aoi-' + s
}

const p2 = (n: number) => String(n).padStart(2, '0')
export const fmtTs = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
}

const MIN = 60_000
export const HISTORY = (now: number): AuditRow[] => {
  const D = 86_400_000
  const r = (cid: string, ago: number, role: Role, intent: string, model: string, path: string, external = false, wait = 0): AuditRow => ({ cid, ts: now - ago, role, intent, model, path, external, wait })
  return [
    r('aoi-7x9f2', 2 * D, 'Student', 'Policy', 'AOI Policy', 'Local RAG'),
    r('aoi-m3k8q', 3 * D, 'Student', 'Research', 'External LLM (anonymized)', 'PII Stripper → External', true),
    r('aoi-b4n6w', 41 * MIN, 'Faculty', 'Policy', 'AOI Policy', 'Local RAG', false, 6200),
    r('aoi-t8c2d', 58 * MIN, 'Student', 'General', 'AOI General', 'Local LLM'),
    r('aoi-h5r9e', 95 * MIN, 'Staff', 'Policy', 'AOI Policy', 'Local RAG'),
    r('aoi-k2v7s', 2.4 * 60 * MIN, 'Student', 'Homework (refused)', 'None (rule-based)', 'Policy Guard → Refused'),
    r('aoi-p9x3f', 3.1 * 60 * MIN, 'Faculty', 'Research', 'External LLM (anonymized)', 'PII Stripper → External', true),
    r('aoi-w6j4n', 5 * 60 * MIN, 'Student', 'General', 'AOI General', 'Local LLM', false, 11800),
    r('aoi-d3q8m', 7 * 60 * MIN, 'Student', 'Policy', 'AOI Policy', 'Local RAG', false, 4300),
    r('aoi-z7e5y', 9 * 60 * MIN, 'Staff', 'Research', 'External LLM (anonymized)', 'PII Stripper → External', true),
    r('aoi-g4s2c', 1 * D + 3 * 60 * MIN, 'Student', 'General', 'AOI General', 'Local LLM'),
    r('aoi-n8u6a', 1 * D + 6 * 60 * MIN, 'Faculty', 'Policy', 'AOI Policy', 'Local RAG'),
  ]
}

export type SourceDoc = { title: string; external: boolean; ref: string; snippet: string; score: number; chunk: string }

export const SOURCE_DOCS: Record<string, SourceDoc> = {
  'Student Handbook p.12': {
    title: 'Student Handbook 2025–2026',
    external: false,
    ref: 'Admission & Enrollment · p.12',
    score: 0.94,
    chunk: 'handbook#c12-3',
    snippet:
      'Freshmen applicants must submit the following: (a) Form 138 or Report Card, (b) Certificate of Good Moral Character, (c) PSA-issued Birth Certificate, and (d) two (2) recent 2×2 photographs. Incomplete submissions will not be processed by the Registrar.',
  },
  'Registrar Memo 2025-04': {
    title: 'Registrar Memo 2025-04 · Enrollment Schedule',
    external: false,
    ref: 'Office of the Registrar · p.1',
    score: 0.88,
    chunk: 'memo-2025-04#c1-1',
    snippet:
      'Enrollment follows the registrar’s published schedule. Freshmen enroll first (June 3–7), followed by continuing students by college. Tuition is assessed per unit once the dean has approved the student’s load.',
  },
  'Semantic Scholar': {
    title: 'Need-Based Aid and Retention in Philippine State Universities',
    external: true,
    ref: 'Semantic Scholar · abstract',
    score: 0.81,
    chunk: 'ext#ss-2291',
    snippet:
      'Across eleven state universities, scholarship recipients whose stipends were paired with academic advising showed a 9-point higher second-year retention rate than those receiving stipends alone.',
  },
  OpenAlex: {
    title: 'Comparing Eligibility and Renewal Rules in Public Scholarship Programs',
    external: true,
    ref: 'OpenAlex · abstract',
    score: 0.77,
    chunk: 'ext#oa-7710',
    snippet:
      'Programs differ chiefly in eligibility thresholds, the share of tuition covered, and the GPA conditions required for renewal. Renewal rules were the strongest predictor of scholar attrition.',
  },
}

export const ANNOUNCEMENTS = [
  { tag: 'Registrar', date: 'Oct 16', title: 'Midterm grade submission extended to Oct 25', body: 'Faculty may now encode midterm grades through the portal until October 25, 5:00 PM.' },
  { tag: 'Scholarships', date: 'Oct 14', title: 'CHED merit scholarship applications are open', body: 'Submit requirements to the Scholarship Office by November 8. Walk-in assistance is available daily.' },
  { tag: 'Library', date: 'Oct 12', title: 'Extended library hours during midterm week', body: 'The main library will stay open until 9:00 PM from Monday to Friday.' },
]

function BgVideo() {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sync = () => { if (still || document.hidden) v.pause(); else v.play().catch(() => {}) }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])
  return <video ref={ref} aria-hidden src={portalBg} autoPlay loop muted playsInline preload="metadata" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
}

const ico = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const HomeIcon = ({ size = 20 }: { size?: number }) => (
  <svg {...ico} width={size} height={size} aria-hidden>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v10h5v-6h4v6h5V10" />
  </svg>
)

const BackBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button type="button" aria-label={label} onClick={onClick} className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 hover:bg-t-tint/10 active:scale-90">
    <HomeIcon />
  </button>
)

export function MsuMark({ size = 32 }: { size?: number }) {
  return <img src={msuLogo} alt="MSU-ZS" width={size} height={size} style={{ width: size, height: size }} className="shrink-0 select-none object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]" draggable={false} />
}

export function Login({ onLogin }: { onLogin: (email: string, id: string) => void }) {
  const [email, setEmail] = useState('')
  const [idn, setIdn] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const fails = useRef(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const now = Date.now()
    if (lockedUntil > now) {
      setErr(`Too many attempts. Try again in ${Math.ceil((lockedUntil - now) / 1000)}s.`)
      return
    }
    const fail = (msg: string) => {
      fails.current += 1
      if (fails.current >= 5) {
        fails.current = 0
        setLockedUntil(now + 30_000)
        setErr('Too many attempts. Try again in 30s.')
      } else setErr(msg)
    }
    if (!email.trim() || !idn.trim()) {
      setErr('Please enter your credentials.')
      return
    }
    if (!EMAIL_RE.test(email.trim())) return fail(`Use your institutional @${INSTITUTION_DOMAIN} email.`)
    if (!ID_RE.test(idn.trim())) return fail('Enter a valid ID number (e.g. 2024-00123).')
    fails.current = 0
    setErr('')
    setBusy(true)
    window.setTimeout(() => onLogin(email.trim(), idn.trim()), 1400)
  }
  const field = 'mt-1.5 w-full rounded-xl border bg-white/[0.06] px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none transition-colors duration-200 focus:border-[#E5707E] focus:bg-white/[0.09] autofill:[-webkit-text-fill-color:#fff]'
  const pts = [
    ['Data stays on campus', 'Queries are answered by university-hosted models first.'],
    ['Private by design', 'Personal details are stripped before any external lookup.'],
    ['Fully traceable', 'Every answer has a correlation ID in the audit log.'],
  ]
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-y-auto bg-[#07080C] px-5 pb-[calc(2rem+var(--sa-bottom))] pt-[calc(2rem+var(--sa-top))] text-white no-scrollbar md:px-12">
      <BgVideo />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(120deg, rgba(7,8,12,0.9) 0%, rgba(40,0,6,0.78) 55%, rgba(7,8,12,0.85) 100%)' }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="aoi-breathe absolute -left-32 -top-32 h-[460px] w-[460px] rounded-full bg-[#800000]/40 blur-[110px]" />
      </div>

      <div className="relative mx-auto my-auto flex w-full max-w-[1040px] flex-col items-center gap-8 md:flex-row md:items-center md:justify-between md:gap-14">
        <div className="aoi-fade-in flex w-full max-w-[420px] flex-col items-center gap-3 text-center md:max-w-[460px] md:items-start md:text-left">
          <div className="flex items-center gap-3">
            <MsuMark size={68} />
            <span className="h-8 w-px bg-white/25" />
            <span className="flex items-center gap-1 text-[36px] font-extrabold leading-none tracking-tight">
              AOI
              <span className="mt-3 h-2.5 w-2.5 rounded-full bg-[#B01E2E]" />
            </span>
          </div>
          <span className="rounded-full border border-white/25 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">MSU-ZS</span>
          <h2 className="hidden text-[40px] font-extrabold leading-[1.05] tracking-tight md:mt-3 md:block">Academic Operations Intelligence.</h2>
          <p className="text-[13px] text-white/60 md:text-[15px]">Mindanao State University – Zamboanga Sibugay</p>
          <ul className="mt-4 hidden w-full flex-col gap-3 md:flex">
            {pts.map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#800000] text-white">
                  <svg {...ico} width={13} height={13}><path d="m5 12 5 5 9-10" /></svg>
                </span>
                <span>
                  <span className="block text-[14px] font-bold">{t}</span>
                  <span className="mt-1 block text-[13px] text-white/60">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

      <form
        onSubmit={submit}
        noValidate
        className="aoi-in relative w-full max-w-[420px] shrink-0 rounded-[24px] border border-white/20 bg-black/35 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl md:p-8"
      >
        <h1 className="text-[24px] font-extrabold tracking-tight">Institutional Login</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/60">Please verify your identity to access the AOI Portal.</p>

        <label className="mt-6 block text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60">
          Institutional Email
          <span className="relative block">
          <svg {...ico} width={16} height={16} className="pointer-events-none absolute left-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-white/40"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
          <input
            type="email"
            autoComplete="off"
            maxLength={254}
            spellCheck={false}
            value={email}
            disabled={busy}
            onChange={(e) => { setEmail(e.target.value); setErr('') }}
            placeholder="student@msuzs.edu.ph"
            className={`${field} pl-10 ${err && !email.trim() ? 'border-red-400/80' : 'border-white/15'}`}
          />
          </span>
        </label>
        <label className="mt-4 block text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60">
          ID Number
          <span className="relative block">
          <svg {...ico} width={16} height={16} className="pointer-events-none absolute left-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-white/40"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M14 9h4M14 13h4M6 17c.6-1.6 1.7-2 3-2s2.4.4 3 2" /></svg>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={20}
            value={idn}
            disabled={busy}
            onChange={(e) => { setIdn(e.target.value); setErr('') }}
            placeholder="2024-00123"
            className={`${field} pl-10 font-mono ${err && !idn.trim() ? 'border-red-400/80' : 'border-white/15'}`}
          />
          </span>
        </label>

        <p role="alert" className={`mt-3 flex items-center gap-1.5 text-[13px] font-medium text-red-400 transition-all duration-200 ${err ? 'h-5 opacity-100' : 'h-0 overflow-hidden opacity-0'}`}>
          <svg {...ico} width={14} height={14}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
          {err}
        </p>

        <button
          type="submit"
          disabled={busy}
          style={{ background: 'linear-gradient(135deg, #B01E2E, #800000 55%, #4a0000)' }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-bold text-white shadow-[0_10px_28px_rgba(128,0,0,0.55)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-90"
        >
          {busy ? (
            <>
              <span className="aoi-spin h-4 w-4 rounded-full border-2 border-white/40 border-t-white" />
              Verifying…
            </>
          ) : (
            'Verify & Login'
          )}
        </button>
        <p className="mt-4 flex items-start justify-center gap-1.5 text-[11.5px] leading-snug text-white/45">
          <svg {...ico} width={12} height={12} className="mt-[2px] shrink-0"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
          <span>Your role is assigned automatically from your institutional account.</span>
        </p>
      </form>
      </div>
    </div>
  )
}

const SERVICES: { title: string; desc: string; href?: string; icon: React.ReactNode }[] = [
  { title: 'My Grades', desc: 'Opens the MSU-ZS student grades portal', href: 'https://myschool.msubuug.edu.ph/index.php?r=site%2Flogin', icon: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="m8 15 3-4 3 2 5-6" /></> },
  { title: 'MSU-ZS Homepage', desc: 'Official university website', href: 'https://msubuug.edu.ph/', icon: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></> },
  { title: 'Account Settings', desc: 'Profile, password and contact info', icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></> },
]

const SectionHead = ({ n, title, sub }: { n: string; title: string; sub: string }) => (
  <div className="flex items-end gap-3 border-b-2 border-[#800000] pb-2">
    <span className="font-mono text-[12px] font-bold text-t-accent">{n}</span>
    <h2 className="text-[17px] font-extrabold tracking-tight md:text-[19px]">{title}</h2>
    <span className="mb-0.5 hidden text-[12.5px] text-t-muted sm:block">{sub}</span>
  </div>
)

export function Portal({
  role,
  name,
  avatar,
  counts,
  onOpen,
  onAsk,
  onSignOut,
}: {
  role: Role
  name: string
  onAsk: (text: string) => void
  avatar: React.ReactNode
  counts: { chats: number; queries: number; local: number }
  onOpen: (v: View) => void
  onSignOut: () => void
}) {
  const [ask, setAsk] = useState('')
  const [tag, setTag] = useState('All')
  const [askErr, setAskErr] = useState(false)
  const hr = new Date().getHours()
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const first = name.split(' ')[0]
  const stats = [
    { label: 'Saved chats', value: counts.chats, view: 'chat' as View },
    { label: role === 'Admin' ? 'Logged queries' : 'Your queries', value: counts.queries, view: 'audit' as View },
    { label: 'Answered on campus', value: `${counts.local}%`, view: 'audit' as View },
  ]
  const tags = ['All', ...Array.from(new Set(ANNOUNCEMENTS.map((a) => a.tag)))]
  const cards: { view: View; title: string; desc: string; meta: string; icon: React.ReactNode; primary?: boolean }[] = [
    { view: 'chat', title: 'Academic Chat', desc: 'Ask about policies, research or campus services with cited answers.', meta: `${counts.chats} saved conversations`, primary: true, icon: <path d="M21 12a8 8 0 0 1-11.7 7.1L3 21l1.9-6.3A8 8 0 1 1 21 12z" /> },
    { view: 'audit', title: 'System Audit Log', desc: role === 'Admin' ? 'Trace every query across all accounts, including external calls.' : 'Review your own queries by correlation ID, including external calls.', meta: role === 'Admin' ? `${counts.queries} queries · all accounts` : `${counts.queries} of your queries`, icon: <><path d="M9 3h6l1 2h3v16H5V5h3z" /><path d="M9 12h6M9 16h4" /></> },
    { view: 'research', title: 'AI Research', desc: 'External AI for research, routed through a PII and consent gate.', meta: '3-tier research ladder', icon: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.2-4.2M11 8v6M8 11h6" /></> },
  ]
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <BgVideo />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-t-bg/80" />
      <header className="relative z-30 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-t-line bg-t-surface px-4 pb-2.5 pt-[calc(0.625rem+var(--sa-top))] shadow-elev-1 md:px-8">
        <div className="flex items-center gap-2.5">
          <MsuMark size={40} />
          <span className="hidden h-6 w-px bg-t-line2 sm:block" />
          <span className="flex items-center gap-1 text-[20px] font-extrabold tracking-tight">
            AOI
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#B01E2E]" />
          </span>
          <span className="hidden rounded border border-t-line2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-t-muted sm:block">MSU-ZS</span>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="order-2 ml-auto flex items-center gap-1.5 rounded-full border border-t-line2 px-3 py-1.5 text-[13px] font-semibold transition-colors duration-200 hover:border-t-accent hover:bg-[#800000] hover:text-white active:scale-95 md:order-3 md:ml-0"
        >
          <svg {...ico} width={14} height={14}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>
          Sign Out
        </button>
        <div className="order-3 flex basis-full items-center gap-2 md:order-2 md:ml-auto md:basis-auto">
          <button type="button" onClick={() => onOpen('about')} className="flex items-center gap-1.5 rounded-full border border-t-tint/10 bg-t-tint/5 px-3 py-1.5 text-[13px] font-semibold transition-colors duration-200 hover:bg-t-tint/10">
            <svg {...ico} width={14} height={14}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
            About AOI
          </button>
          <span title="Role assigned to your account" className="flex items-center gap-1.5 rounded-full border border-[#800000]/60 bg-[#800000]/15 px-3 py-1.5 text-[13px] font-semibold text-t-accent">
            <svg {...ico} width={13} height={13}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
            {role}
          </span>
        </div>
      </header>

      <main className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto pb-[calc(2rem+var(--sa-bottom))]">
        <section
          className="aoi-fade-in relative overflow-hidden text-white"
          style={{ background: 'var(--hero)' }}
        >
          <span aria-hidden className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 22px)' }} />
          <span aria-hidden className="absolute -right-10 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-sky-300/25 blur-3xl" />
          <div className="relative mx-auto flex w-full max-w-[1040px] items-center justify-between gap-3 px-4 pt-6 md:px-8 md:pt-9 lg:static">
            <div className="min-w-0 pb-4 md:pb-6 lg:pr-[240px]">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/20 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em]">
                <svg {...ico} width={12} height={12}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>
                Verified · {role}
              </p>
              <p className="mt-3 text-[12px] font-medium text-white/70">{today}</p>
              <h1 className="mt-1 text-[24px] font-extrabold leading-[1.08] tracking-tight md:text-[44px]">{greet}, {first}.</h1>
              <p className="mt-2 max-w-[420px] text-[14px] leading-relaxed text-white/85 md:text-[16px]">
                Welcome to the University Portal. How can we help you today?
              </p>
            </div>
            <div className="relative -mb-px shrink-0 self-end [mask-image:linear-gradient(to_bottom,#000_70%,transparent)] [mask-repeat:no-repeat] lg:absolute lg:bottom-0 lg:right-[max(2rem,calc((100%-1040px)/2+2rem))] lg:mb-0 lg:[mask-image:none]">{avatar}</div>
          </div>
          <div className="relative mx-auto w-full max-w-[1040px] px-4 pb-6 md:px-8 md:pb-8">
              <form
                className={`flex max-w-[520px] items-center gap-1.5 rounded-full border bg-black/25 p-1 pl-4 backdrop-blur-sm focus-within:border-white/60 ${askErr ? 'border-red-300' : 'border-white/25'}`}
                onSubmit={(e) => { e.preventDefault(); if (ask.trim()) onAsk(ask.trim()); else setAskErr(true) }}
              >
                <input
                  value={ask}
                  maxLength={500}
                  onChange={(e) => { setAsk(e.target.value); setAskErr(false) }}
                  placeholder={askErr ? 'Type a question first…' : 'Ask AOI anything about campus…'}
                  aria-label="Ask AOI"
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/55"
                />
                <button type="submit" aria-label="Start chat" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#800000] transition-transform active:scale-90">
                  <svg {...ico} width={16} height={16}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </form>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[1040px] px-4 md:px-8">
          <div className="mt-5 grid grid-cols-3 gap-2.5 md:gap-3" aria-label="Overview">
            {stats.map((x) => (
              <button key={x.label} type="button" onClick={() => onOpen(x.view)} className="rounded-2xl border border-t-line bg-t-surface px-3 py-3 text-left shadow-elev-1 transition-colors hover:border-t-accent active:scale-[0.98] md:px-4">
                <span className="block font-mono text-[22px] font-bold leading-none text-t-accent md:text-[28px]">{x.value}</span>
                <span className="mt-1.5 block text-[11px] leading-tight text-t-muted md:text-[12.5px]">{x.label}</span>
              </button>
            ))}
          </div>

          <section className="mt-8" aria-label="Academic Services">
            <SectionHead n="01" title="Academic Services" sub="Institutional records and enrollment" />
            <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3 lg:grid-cols-3">
              {SERVICES.filter((s) => s.title !== 'My Grades' || role === 'Student').map((s) => {
                const cls = 'group flex items-center gap-3 rounded-2xl border border-t-line bg-t-surface px-4 py-3 shadow-elev-1 text-left transition-colors duration-200 hover:border-t-accent hover:bg-t-tint/5 active:scale-[0.99]'
                const inner = (
                  <>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#800000]/25 text-t-accent">
                      <svg {...ico}>{s.icon}</svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-bold">{s.title}</span>
                      <span className="block truncate text-[12px] text-t-muted">{s.desc}</span>
                    </span>
                    <svg {...ico} width={15} height={15} className="text-t-subtle transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-t-accent"><path d="M7 17 17 7M8 7h9v9" /></svg>
                  </>
                )
                return s.href ? (
                  <a key={s.title} href={s.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
                ) : (
                  <button key={s.title} type="button" onClick={() => onOpen('account')} className={cls}>{inner}</button>
                )
              })}
            </div>
          </section>

          <section className="mt-9" aria-label="AOI Chat">
            <SectionHead n="02" title="AOI Chat" sub="Ask, audit and verify with cited answers" />
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
              {cards.map((c, i) => (
                <button
                  key={c.view}
                  type="button"
                  onClick={() => onOpen(c.view)}
                  style={{ animationDelay: `${0.08 + i * 0.07}s`, ...(c.primary ? { background: 'linear-gradient(145deg, #800000, #4a0000)' } : undefined) }}
                  className={`aoi-in group flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all duration-200 ease-in-out hover:-translate-y-1 active:scale-[0.98] ${c.primary ? 'border-[#B01E2E]/60 text-white shadow-[0_10px_30px_rgba(128,0,0,0.45)]' : 'border-t-tint/10 bg-t-surface/70 shadow-elev-2 backdrop-blur-md hover:border-t-accent'}`}
                >
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.primary ? 'bg-white/15 text-white' : 'bg-[#800000]/30 text-t-accent group-hover:bg-[#800000]/60 group-hover:text-t-fg'}`}>
                    <svg {...ico} width={22} height={22}>{c.icon}</svg>
                  </span>
                  <span>
                    <span className="block text-[17px] font-bold">{c.title}</span>
                    <span className={`mt-1 block text-[13px] leading-snug ${c.primary ? 'text-white/80' : 'text-t-muted'}`}>{c.desc}</span>
                  </span>
                  <span className={`mt-auto flex w-full items-center justify-between pt-1 text-[12px] font-medium ${c.primary ? 'text-white/70' : 'text-t-soft'}`}>
                    {c.meta}
                    <svg {...ico} width={16} height={16} className="transition-transform duration-200 group-hover:translate-x-1"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-9" aria-label="Campus bulletins">
            <SectionHead n="03" title="Campus Bulletins" sub="Official notices from university offices" />
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
              {tags.map((t) => (
                <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(t)} className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${tag === t ? 'border-[#800000] bg-[#800000] text-white' : 'border-t-line2 text-t-muted hover:text-t-fg'}`}>{t}</button>
              ))}
            </div>
            <ul className="mt-3 divide-y divide-t-line overflow-hidden rounded-2xl border border-t-line bg-t-surface shadow-elev-1">
              {ANNOUNCEMENTS.filter((a) => tag === 'All' || a.tag === tag).map((a) => {
                const [mon, day] = a.date.split(' ')
                return (
                  <li key={a.title} className="flex gap-4 px-4 py-4 md:px-5">
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[#800000] text-white">
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/75">{mon}</span>
                      <span className="text-[20px] font-extrabold leading-none">{day}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded border border-[#800000]/60 px-1.5 py-px text-[10.5px] font-bold uppercase tracking-[0.08em] text-t-accent">{a.tag}</span>
                        <span className="text-[11px] text-t-subtle">2026</span>
                      </div>
                      <p className="mt-1.5 text-[15px] font-bold leading-snug">{a.title}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-t-muted">{a.body}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </main>
    </div>
  )
}

const QueueTag = ({ wait }: { wait?: number }) =>
  wait && wait > 0 ? <span title="Waited in the local GPU queue" className="ml-1.5 inline-block rounded border border-t-line2 px-1 py-px align-middle font-mono text-[10px] text-t-muted">queued {(wait / 1000).toFixed(1)}s</span> : null

const Yes = () => <span className="inline-flex items-center gap-1.5 rounded-full bg-[#800000] px-2 py-0.5 text-[11px] font-bold text-white"><span className="h-1.5 w-1.5 rounded-full bg-white" />Yes</span>
const No = () => <span className="inline-flex items-center rounded-full bg-t-tint/10 px-2 py-0.5 text-[11px] font-semibold text-t-muted">No</span>

export function AuditLog({ rows, onHome, focusCid, admin }: { rows: AuditRow[]; onHome: () => void; focusCid: string | null; admin: boolean }) {
  const [filter, setFilter] = useState<'all' | 'external' | 'queued'>('all')
  const [q, setQ] = useState('')
  const total = rows.length
  const ext = rows.filter((r) => r.external).length
  const queued = rows.filter((r) => (r.wait ?? 0) > 0)
  const avgWait = queued.length ? queued.reduce((t, r) => t + (r.wait ?? 0), 0) / queued.length / 1000 : 0
  const list = rows.filter((r) => (filter === 'all' || (filter === 'external' ? r.external : (r.wait ?? 0) > 0)) && (!q || r.cid.includes(q.toLowerCase().trim())))
  const focusRef = useRef<HTMLElement | null>(null)
  const refFor = (cid: string) => (el: HTMLElement | null) => {
    if (el && cid === focusCid && focusRef.current !== el) {
      focusRef.current = el
      requestAnimationFrame(() => el.scrollIntoView({ block: 'center' }))
    }
  }
  const cols = ['Timestamp', 'Correlation ID', 'Role', 'Intent', 'Model Used', 'Path', 'External Call']
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="relative z-30 flex shrink-0 items-center gap-2 border-b border-t-line bg-t-surface px-3 pb-2 pt-[calc(0.5rem+var(--sa-top))] shadow-elev-1 md:px-6">
        <BackBtn onClick={onHome} label="Back to Portal" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-bold leading-tight">System Audit Log</h1>
          <p className="text-[11px] text-t-muted">{admin ? 'Administrator view · all accounts' : 'Your activity only'}</p>
        </div>
      </header>
      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(2rem+var(--sa-bottom))] pt-5 md:px-8 md:pt-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <p className="aoi-fade-in inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-t-tint/10 bg-t-surface/80 px-4 py-3 text-[13px] font-semibold backdrop-blur-md md:text-[14px]" role="status">
            <span>Total Queries: <b className="font-mono text-[15px]">{total}</b></span>
            <span aria-hidden className="text-t-subtle">|</span>
            <span className="text-t-accent">External Calls: <b className="font-mono text-[15px]">{ext}</b></span>
            <span aria-hidden className="text-t-subtle">|</span>
            <span>Queued for GPU: <b className="font-mono text-[15px]">{queued.length}</b>{queued.length > 0 && <span className="ml-1 font-normal text-t-muted">· avg {avgWait.toFixed(1)}s</span>}</span>
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(['all', 'external', 'queued'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold capitalize transition-all duration-200 ${filter === f ? 'border-[#800000] bg-[#800000] text-white' : 'border-t-line2 text-t-soft hover:bg-t-tint/5 hover:text-t-fg'}`}
              >
                {f === 'all' ? 'All' : f === 'external' ? 'External only' : 'Queued only'}
              </button>
            ))}
            <label className="ml-auto flex h-9 min-w-[160px] flex-1 items-center gap-2 rounded-full border border-t-line bg-t-input px-3 focus-within:border-t-accent md:max-w-[240px] md:flex-none">
              <svg {...ico} width={14} height={14}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find ID…" aria-label="Find correlation ID" className="min-w-0 flex-1 bg-transparent font-mono text-[12px] outline-none placeholder:text-t-subtle" />
            </label>
          </div>

          <div className="mt-4 hidden overflow-hidden rounded-2xl border border-t-tint/10 bg-t-surface/80 shadow-elev-2 backdrop-blur-md md:block">
            <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-t-line bg-t-deep/80 text-[10.5px] font-bold uppercase tracking-[0.1em] text-t-muted">
                    {cols.map((c) => (
                      <th key={c} className="whitespace-nowrap px-4 py-3">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr
                      key={r.cid}
                      ref={refFor(r.cid)}
                      className={`border-b border-t-line/60 transition-colors last:border-0 ${r.external ? 'bg-[#800000]/15 hover:bg-[#800000]/25' : 'hover:bg-t-tint/5'} ${r.cid === focusCid ? 'outline outline-2 -outline-offset-2 outline-[#B01E2E]' : ''}`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-t-soft">{fmtTs(r.ts)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] font-semibold text-t-fg">{r.cid}</td>
                      <td className="px-4 py-3">{r.role}</td>
                      <td className="px-4 py-3 font-medium">{r.intent}</td>
                      <td className="px-4 py-3 text-t-soft">{r.model}</td>
                      <td className="px-4 py-3 text-t-soft">
                        {r.path}
                        <QueueTag wait={r.wait} />
                      </td>
                      <td className="px-4 py-3">{r.external ? <Yes /> : <No />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ul className="mt-4 flex flex-col gap-2.5 md:hidden">
            {list.map((r) => (
              <li key={r.cid} ref={refFor(r.cid)} className={`rounded-2xl border p-3.5 ${r.external ? 'border-[#800000]/60 bg-[#800000]/15' : 'border-t-tint/10 bg-t-surface/80'} ${r.cid === focusCid ? 'outline outline-2 outline-[#B01E2E]' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[13px] font-semibold">{r.cid}</span>
                  {r.external ? <Yes /> : <No />}
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-t-muted">{fmtTs(r.ts)}</p>
                <dl className="mt-2 grid grid-cols-[84px_1fr] gap-y-1 text-[12px]">
                  <dt className="text-t-muted">Role</dt><dd>{r.role}</dd>
                  <dt className="text-t-muted">Intent</dt><dd className="font-medium">{r.intent}</dd>
                  <dt className="text-t-muted">Model</dt><dd>{r.model}</dd>
                  <dt className="text-t-muted">Path</dt><dd>{r.path}<QueueTag wait={r.wait} /></dd>
                </dl>
              </li>
            ))}
          </ul>
          {!list.length && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-t-tint/5 text-t-muted">
                <svg {...ico} width={20} height={20}><path d="M9 3h6l1 2h3v16H5V5h3z" /><path d="M9 12h6M9 16h4" /></svg>
              </span>
              <p className="text-[13px] text-t-muted">No matching entries.</p>
            </div>
          )}
          <p className="mt-4 flex items-center gap-2 text-[11.5px] text-t-muted">
            <span className="inline-block h-3 w-5 rounded bg-[#800000]/40" /> Highlighted rows left the Data Sovereignty Boundary (anonymized external call).
          </p>
        </div>
      </main>
    </div>
  )
}

export function SourceSheet({ label, onClose, onAsk }: { label: string | null; onClose: () => void; onAsk: (label: string) => void }) {
  const last = useRef<string | null>(null)
  if (label) last.current = label
  const shown = label ?? last.current
  const d = shown ? SOURCE_DOCS[shown] : undefined
  const open = !!label
  return (
    <div className={`absolute inset-0 z-[65] flex items-end justify-center ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <div
        inert={!open}
        role="dialog"
        aria-label="Source excerpt"
        className={`relative w-full rounded-t-[24px] border-t border-t-tint/10 bg-t-deep px-5 pt-3 text-t-fg transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:max-w-[560px] ${open ? 'translate-y-0 shadow-[0_-12px_40px_rgba(0,0,0,0.6)]' : 'translate-y-full shadow-none'}`}
        style={{ paddingBottom: 'calc(20px + var(--sa-bottom))' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-t-tint/20" />
        {d && shown && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-t-accent">{d.external ? 'External source · anonymized query' : 'Retrieved from local index'}</p>
                <h2 className="mt-1 text-[16px] font-bold leading-snug">{d.title}</h2>
                <p className="mt-0.5 text-[12px] text-t-muted">{d.ref}</p>
              </div>
              <button type="button" aria-label="Close" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-t-muted transition-colors hover:bg-t-tint/10 hover:text-t-fg">
                <svg {...ico} width={18} height={18}><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <blockquote className="mt-4 rounded-r-xl border-l-[3px] border-[#800000] bg-t-tint/5 px-4 py-3 text-[13.5px] leading-relaxed text-t-fg">“{d.snippet}”</blockquote>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-t-subtle">
              <span>relevance {d.score.toFixed(2)}</span>
              <span>chunk {d.chunk}</span>
            </div>
            <button
              type="button"
              onClick={() => onAsk(shown)}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] font-semibold text-white shadow-[0_0_15px_rgba(128,0,0,0.4)] transition-all duration-200 hover:brightness-125 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #800000, #600000)' }}
            >
              <svg {...ico} width={18} height={18} aria-hidden><path d="M21 12a8 8 0 0 1-11.7 7.1L3 21l1.9-6.3A8 8 0 1 1 21 12z" /><path d="M8 11h8M8 14.5h5" /></svg>
              Ask AOI about this
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function synthRow(cid: string, ts: number, role: Role, m: { text: string; external?: boolean; sources?: string[] }): AuditRow {
  const homework = m.text.startsWith("I can't help with homework")
  const error = m.text.startsWith('Sorry, something went wrong')
  const intent = homework ? 'Homework (refused)' : error ? 'Error' : m.external ? 'Research' : m.sources ? 'Policy' : 'General'
  if (homework) return { cid, ts, role, intent, model: 'None (rule-based)', path: 'Policy Guard → Refused', external: false }
  if (error) return { cid, ts, role, intent, model: 'None', path: 'Error handler', external: false }
  if (m.external) return { cid, ts, role, intent, model: 'External LLM (anonymized)', path: 'PII Stripper → External', external: true }
  return { cid, ts, role, intent, model: m.sources ? 'AOI Policy' : 'AOI General', path: m.sources ? 'Local RAG' : 'Local LLM', external: false }
}

export type User = { name: string; email: string; id: string; role: Role }
export const INSTITUTION_DOMAIN = 'msuzs.edu.ph'
export const EMAIL_RE = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?@msuzs\.edu\.ph$/i
export const ID_RE = /^(?:[a-z]{1,3}-?)?\d[\d-]{3,14}$/i
// Role comes from whole tokens of the email local part (not substrings), so "notadmin@..." stays a Student.
export const roleFor = (email: string, id: string): Role => {
  const e = email.trim().toLowerCase(), i = id.trim().toUpperCase()
  if (!EMAIL_RE.test(e)) return 'Student'
  const tokens = e.split('@')[0].split(/[._-]+/)
  const has = (...w: string[]) => tokens.some((t) => w.includes(t))
  if (/^ADM-?\d/.test(i) || has('admin')) return 'Admin'
  if (/^(STF|S)-?\d/.test(i) || has('staff', 'registrar', 'office', 'ict')) return 'Staff'
  if (/^(FAC|F)-?\d/.test(i) || has('prof', 'faculty', 'instructor', 'dr')) return 'Faculty'
  return 'Student'
}
export const userFrom = (email: string, id: string): User => {
  const local = email.trim().split('@')[0] || 'student'
  const name = local.split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ').slice(0, 60) || 'Student'
  return { name, email: email.trim().toLowerCase(), id: id.trim().toUpperCase(), role: roleFor(email, id) }
}
export const initials = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'ST'

export function AccountSettings({
  user, role, theme, setTheme, fontSize, setFontSize, showTime, setShowTime, chatCount, onClearChats, onReset, onHome, onSignOut,
}: {
  user: User; role: Role
  theme: 'system' | 'light' | 'dark'; setTheme: (t: 'system' | 'light' | 'dark') => void
  fontSize: 'sm' | 'md' | 'lg'; setFontSize: (s: 'sm' | 'md' | 'lg') => void
  showTime: boolean; setShowTime: (b: boolean) => void
  chatCount: number; onClearChats: () => void; onReset: () => void; onHome: () => void; onSignOut: () => void
}) {
  const seg = (on: boolean) => `rounded-[9px] py-2 text-[14px] font-medium capitalize transition-all duration-200 ${on ? 'bg-[#800000] text-white shadow-[0_0_12px_rgba(128,0,0,0.5)]' : 'text-t-muted hover:text-t-fg'}`
  const label = 'mb-2 mt-6 text-[12px] font-semibold uppercase tracking-[0.08em] text-t-muted'
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="relative z-30 flex shrink-0 items-center gap-2 border-b border-t-line bg-t-surface px-3 pb-2 pt-[calc(0.5rem+var(--sa-top))] shadow-elev-1 md:px-6">
        <BackBtn onClick={onHome} label="Back to Portal" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-bold leading-tight">Account Settings</h1>
          <p className="truncate text-[11px] text-t-muted">Profile, appearance and session</p>
        </div>
        <button type="button" onClick={onSignOut} className="flex h-9 items-center gap-1.5 rounded-full border border-t-line2 px-3 text-[13px] font-semibold transition-colors hover:border-t-accent hover:bg-[#800000] hover:text-white active:scale-95">
          <svg {...ico} width={14} height={14}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>
          Log out
        </button>
      </header>
      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(2rem+var(--sa-bottom))] pt-5 md:px-8 md:pt-8">
        <div className="mx-auto w-full max-w-[640px]">
          <section className="flex items-center gap-4 rounded-xl border border-t-line bg-t-surface p-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#800000] text-[18px] font-bold text-white">{initials(user.name)}</span>
            <div className="min-w-0">
              <p className="truncate text-[17px] font-bold">{user.name}</p>
              <p className="truncate text-[13px] text-t-muted">{user.email}</p>
              <p className="mt-0.5 font-mono text-[12px] text-t-subtle">ID {user.id}</p>
            </div>
          </section>

          <p className={label}>Access role</p>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-t-line bg-t-surface px-4 py-3">
            <span>
              <span className="block text-[14px] font-semibold">{role}</span>
              <span className="block text-[12px] text-t-muted">{ROLES.find((r) => r.value === role)?.desc}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-t-tint/10 px-2.5 py-1 text-[11px] font-semibold text-t-muted">
              <svg {...ico} width={12} height={12}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
              Assigned
            </span>
          </div>
          <p className="mt-2 text-[12px] text-t-subtle">Each account has one role, assigned by the University. Contact the Registrar or ICT Office to request a change.</p>

          <p className={label}>Appearance</p>
          <div className="grid grid-cols-3 gap-2 rounded-[12px] bg-t-surface p-1">
            {(['system', 'light', 'dark'] as const).map((k) => <button key={k} type="button" aria-pressed={theme === k} onClick={() => setTheme(k)} className={seg(theme === k)}>{k}</button>)}
          </div>

          <p className={label}>Text size</p>
          <div className="grid grid-cols-3 gap-2 rounded-[12px] bg-t-surface p-1">
            {(['sm', 'md', 'lg'] as const).map((k) => <button key={k} type="button" aria-pressed={fontSize === k} onClick={() => setFontSize(k)} className={seg(fontSize === k)}>{k === 'sm' ? 'Small' : k === 'md' ? 'Medium' : 'Large'}</button>)}
          </div>

          <button type="button" role="switch" aria-checked={showTime} onClick={() => setShowTime(!showTime)} className="mt-6 flex w-full items-center justify-between rounded-xl border border-t-line bg-t-surface px-4 py-3 text-left">
            <span>
              <span className="block text-[14px] font-medium">Show timestamps</span>
              <span className="block text-[12px] text-t-muted">Display the time under each chat message</span>
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${showTime ? 'bg-[#800000]' : 'bg-t-line'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-200 ${showTime ? 'left-[22px]' : 'left-0.5'}`} />
            </span>
          </button>

          <p className={label}>Data on this device</p>
          <div className="flex gap-2">
            <button type="button" onClick={onReset} className="h-11 flex-1 rounded-[12px] border border-t-line2 bg-t-tint/5 text-[14px] font-semibold transition-all hover:bg-t-tint/10 active:scale-[0.98]">Reset preferences</button>
            <button type="button" onClick={onClearChats} disabled={!chatCount} className="h-11 flex-1 rounded-[12px] border border-[#800000] bg-[#800000]/20 text-[14px] font-semibold text-t-accent transition-all hover:bg-[#800000]/40 active:scale-[0.98] disabled:opacity-40">Clear {chatCount} chats</button>
          </div>

          <button type="button" onClick={onSignOut} style={{ background: 'linear-gradient(135deg, #B01E2E, #800000 55%, #4a0000)' }} className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-white shadow-[0_10px_28px_rgba(128,0,0,0.4)] transition-all hover:brightness-110 active:scale-[0.98]">
            <svg {...ico} width={16} height={16}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>
            Log out
          </button>
          <p className="mt-3 text-center text-[12px] text-t-subtle">Logging out returns you to the Institutional Login.</p>
        </div>
      </main>
    </div>
  )
}

const TIERS: { tier: string; name: string; sub: string; model: string; where: 'local' | 'external'; rule: string; out: string; bar: string }[] = [
  { tier: 'Tier 1', name: 'Lightweight STEM', sub: 'research-stem-light', model: 'aoi-scholarmini', where: 'local', rule: 'Query under 150 tokens and no synthesis keywords', out: 'Simple local result', bar: 'bg-emerald-500' },
  { tier: 'Tier 2', name: 'Deep Local', sub: 'research-stem-deep', model: 'aoi-scholar', where: 'local', rule: '150 tokens or more, or synthesis keywords (compare, analyze, evaluate, synthesize, critique)', out: 'Complex synthesized local result', bar: 'bg-sky-500' },
  { tier: 'Tier 3', name: 'External Synthesis', sub: 'research-general', model: 'OpenRouter free tier', where: 'external', rule: 'Needs multi-source integration beyond the local index', out: 'External multi-source integrated result', bar: 'bg-rose-500' },
]

const SubHeader = ({ title, sub, onHome }: { title: string; sub: string; onHome: () => void }) => (
  <header className="relative z-30 flex shrink-0 items-center gap-2 border-b border-t-line bg-t-surface px-3 pb-2 pt-[calc(0.5rem+var(--sa-top))] shadow-elev-1 md:px-6">
    <BackBtn onClick={onHome} label="Back to Portal" />
    <div className="min-w-0 flex-1">
      <h1 className="truncate text-[16px] font-bold leading-tight">{title}</h1>
      <p className="truncate text-[11px] text-t-muted">{sub}</p>
    </div>
  </header>
)

export function AboutAOI({ onHome }: { onHome: () => void }) {
  const paths = [
    { n: 'Homework guard', d: 'Detects graded-work requests and responds with study guidance instead of answers.' },
    { n: 'Policy', d: 'Answers from the University’s own documents using local retrieval, with source citations.' },
    { n: 'Research', d: 'Routes through the research tier ladder, local first, external only with consent.' },
    { n: 'General', d: 'Everyday campus questions answered by a local model.' },
    { n: 'GPU queue', d: 'The campus GPU answers one request at a time. Students and faculty are served first come, first served, and you see your place in line.' },
  ]
  const pillars: [string, string, React.ReactNode][] = [
    ['Data sovereignty', 'Queries stay on university systems unless you approve an anonymized external lookup.', <><rect x="4" y="4" width="16" height="7" rx="2" /><rect x="4" y="13" width="16" height="7" rx="2" /><path d="M8 7.5h.01M8 16.5h.01" /></>],
    ['Privacy by design', 'A PII Stripper removes names, IDs, emails and course codes before anything leaves.', <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />],
    ['Traceable', 'Every answer carries a correlation ID that links to the audit log.', <><path d="M9 3h6l1 2h3v16H5V5h3z" /><path d="M9 12h6M9 16h4" /></>],
  ]
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SubHeader title="About AOI" sub="Academic Operations Intelligence" onHome={onHome} />
      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(2rem+var(--sa-bottom))] pt-6 md:px-8 md:pt-10">
        <div className="mx-auto w-full max-w-[760px]">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-t-accent">MSU-Zamboanga Sibugay</p>
          <h2 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight md:text-[36px]">A campus assistant that keeps your data on campus.</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-t-muted">
            AOI is the University’s academic assistant for students, faculty and staff. It answers policy questions from official documents, supports research with a tiered set of models, and records every query so that nothing happens off the books. This page is sample content for the prototype.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {pillars.map(([t, d, icon]) => (
              <div key={t} className="rounded-2xl border border-t-line bg-t-surface p-4 shadow-elev-1">
                <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#800000]/25 text-t-accent">
                  <svg {...ico} width={18} height={18}>{icon}</svg>
                </span>
                <p className="text-[14px] font-bold">{t}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-t-muted">{d}</p>
              </div>
            ))}
          </div>

          <h3 className="mt-9 border-b-2 border-[#800000] pb-2 text-[17px] font-extrabold">How AOI routes your question</h3>
          <ol className="mt-3 divide-y divide-t-line overflow-hidden rounded-2xl border border-t-line bg-t-surface shadow-elev-1">
            {paths.map((p, i) => (
              <li key={p.n} className="flex gap-4 px-4 py-3.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#800000] font-mono text-[12px] font-bold text-white">{i + 1}</span>
                <span>
                  <span className="block text-[14.5px] font-bold">{p.n}</span>
                  <span className="block text-[13px] leading-relaxed text-t-muted">{p.d}</span>
                </span>
              </li>
            ))}
          </ol>

          <h3 className="mt-9 border-b-2 border-[#800000] pb-2 text-[17px] font-extrabold">Who sees what</h3>
          <p className="mt-3 text-[14px] leading-relaxed text-t-muted">
            Each account has one role assigned by the University. Students, faculty and staff can review only their own query history. Only administrators can see the complete audit log across accounts.
          </p>
          <p className="mt-8 text-[12px] text-t-subtle">AOI v0.9 prototype · mock data only</p>
        </div>
      </main>
    </div>
  )
}

export function ResearchHub({ onHome, onStart, prompts }: { onHome: () => void; onStart: (prompt: string) => void; prompts: { title: string; prompt: string }[] }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SubHeader title="AI Research" sub="Research tier ladder · external AI behind a consent gate" onHome={onHome} />
      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(2rem+var(--sa-bottom))] pt-6 md:px-8 md:pt-8">
        <div className="mx-auto w-full max-w-[1040px]">
          <h2 className="text-[26px] font-extrabold leading-tight tracking-tight md:text-[32px]">Research, answered locally first.</h2>
          <p className="mt-2 max-w-[640px] text-[14px] leading-relaxed text-t-muted">
            The query classifier sends lighter questions to small local models. Only broad, multi-source research can reach an external model, and only after the PII Stripper has run and you have consented.
          </p>

          <div className="mt-6 flex items-center gap-3 rounded-xl border border-t-line bg-t-surface px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#800000] text-white">
              <svg {...ico} width={15} height={15}><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            </span>
            <p className="text-[13px] leading-snug text-t-muted"><b className="text-t-fg">Query classifier</b> reads your research question and picks the lowest tier that can answer it.</p>
          </div>

          <div className="mt-2 grid gap-0 md:grid-cols-3 md:gap-4">
            {TIERS.map((t, i) => (
              <div key={t.tier} className="flex flex-col items-stretch">
                <div className="flex justify-center py-1.5 text-t-subtle"><svg {...ico} width={18} height={18}><path d="M12 4v14M6 12l6 6 6-6" /></svg></div>
                <span className="mx-auto mb-2 rounded-full border border-t-line2 px-2.5 py-0.5 font-mono text-[11px] text-t-accent">{t.sub}</span>
                {i === 2 ? (
                  <div className="flex-1 rounded-xl border border-orange-400/60 bg-orange-400/10 p-3.5">
                    <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-orange-500">Gate</p>
                    <ul className="mt-1.5 space-y-1 text-[12.5px] text-t-soft">
                      <li>PII stripper</li>
                      <li>Consent gateway</li>
                      <li>Separate audit log</li>
                    </ul>
                    <p className="mt-2 border-t border-orange-400/30 pt-2 text-[12px] text-t-muted">PII passed <b className="text-t-fg">and</b> you consented? <span className="font-semibold text-orange-500">No: blocked.</span></p>
                  </div>
                ) : (
                  <div className="flex-1 rounded-xl border border-t-line bg-t-surface p-3.5">
                    <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-t-muted">Rule check</p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-t-soft">{t.rule}</p>
                    <p className="mt-2 border-t border-t-line pt-2 text-[12px] text-t-muted">{i === 0 ? <>No: falls back to <b className="text-t-fg">Tier 2</b>.</> : <>Yes: stays on this tier.</>}</p>
                  </div>
                )}
                <div className="flex justify-center py-1.5 text-t-subtle"><svg {...ico} width={18} height={18}><path d="M12 4v14M6 12l6 6 6-6" /></svg></div>
                <div className="flex flex-col overflow-hidden rounded-xl border border-t-line bg-t-surface">
                  <div className={`h-1.5 ${t.bar}`} />
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-t-muted">{t.tier}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${t.where === 'local' ? 'bg-t-tint/10 text-t-muted' : 'bg-[#800000] text-white'}`}>{t.where}</span>
                    </div>
                    <p className="mt-1.5 text-[17px] font-bold">{t.name}</p>
                    <p className="mt-0.5 text-[13px] font-semibold text-t-soft">{t.model}</p>
                    <p className="mt-auto border-t border-t-line pt-2.5 text-[12.5px] font-medium">{t.out}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-t-line2 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-t-muted">
            <svg {...ico} width={14} height={14} className="mt-0.5 shrink-0"><rect x="3" y="7" width="18" height="10" rx="2" /><path d="M7 11h2M7 13h2M13 10v4M16 10v4" /></svg>
            <span><b className="text-t-fg">Shared GPU:</b> Tiers 1 and 2 run on a single campus GPU that serves one request at a time, in arrival order. Tier 3 runs externally and skips the queue. Every external call is flagged in the audit log.</span>
          </p>

          <h3 className="mt-9 border-b-2 border-[#800000] pb-2 text-[17px] font-extrabold">Start a research chat</h3>
          <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {prompts.map((p) => (
              <button key={p.title} type="button" onClick={() => onStart(p.prompt)} className="group flex min-w-0 items-center justify-between gap-3 rounded-lg border border-t-line bg-t-surface px-4 py-3 text-left transition-colors hover:border-t-accent active:scale-[0.99]">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold">{p.title}</span>
                  <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-t-muted">{p.prompt}</span>
                </span>
                <svg {...ico} width={16} height={16} className="shrink-0 text-t-subtle transition-transform group-hover:translate-x-1 group-hover:text-t-accent"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

// ---- AOI character profile (gacha-style card, academic edition) ----------------------
const AOI_STATS: { key: string; name: string; value: number; note: string }[] = [
  { key: 'CIT', name: 'Citation Accuracy', value: 98, note: 'Every policy answer ships with page numbers.' },
  { key: 'PRV', name: 'Privacy Armor', value: 99, note: 'Strips personal data before any external lookup.' },
  { key: 'INT', name: 'Policy Recall', value: 96, note: 'Has read the whole Student Handbook. Twice.' },
  { key: 'EVA', name: 'Homework Evasion', value: 100, note: 'Will not write your essay. Will help you outline it.' },
  { key: 'RES', name: 'Research Depth', value: 92, note: 'Climbs the three-tier research ladder.' },
  { key: 'STA', name: 'Thesis Stamina', value: 88, note: 'Survives revisions from three panelists.' },
  { key: 'SPD', name: 'Response Speed', value: 74, note: 'One request at a time on a single RTX 4050.' },
  { key: 'LCK', name: 'Curve Luck', value: 41, note: 'Does not believe in the curve. Studies instead.' },
]
const AOI_SKILLS: { name: string; kind: 'Passive' | 'Active'; desc: string; icon: React.ReactNode }[] = [
  { name: 'Handbook Recall', kind: 'Passive', desc: 'Answers policy questions from the Student Handbook and Registrar memos, always with citations. 100% chance to cite the page.', icon: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5M9 7h6" /></> },
  { name: 'Homework Guard', kind: 'Passive', desc: 'When asked to complete graded work, refuses and casts Study Guidance instead. Cannot be dispelled by "please po".', icon: <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" /> },
  { name: 'Consent Barrier', kind: 'Active', desc: 'Before any external research, anonymizes the query and asks for consent. Grants Data Sovereignty to the whole party.', icon: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></> },
  { name: 'One-Slot Focus', kind: 'Passive', desc: 'Serves inquiries one at a time on the campus GPU, strictly first come, first served. Fairness +100%.', icon: <><rect x="3" y="7" width="18" height="10" rx="2" /><path d="M7 11h2M7 13h2M13 10v4M16 10v4" /></> },
]
const AOI_LOADOUT = [
  ['Main', 'Local RAG Index', 'Handbook, memos, curricula'],
  ['Sub', 'PII Stripper', 'Names, IDs, emails, phones'],
  ['Auxiliary', 'RTX 4050 · 6 GB', 'One answer at a time'],
  ['Accessory', 'Audit Log', 'Correlation ID per reply'],
]
const AOI_LINES = [
  'Did you read the handbook? ...It’s okay, I read it for both of us.',
  'I can’t write your essay, but I can help you outline it.',
  'Your data stays on campus. Pinky promise.',
  'One at a time, please. The GPU is only 6 GB.',
  'A citation a day keeps the plagiarism checker away.',
  'Midterms? Deep breath first. Then flashcards.',
  'Enrollment requirements? Form 138, good moral, PSA, two 2×2 photos. You’re welcome.',
]
// Pre-rendered voice lines (Kokoro TTS, Apache-2.0), one folder per voice pack, files named by line index.
const VOICE_FILES = import.meta.glob('./voice/*/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const VOICE_PACKS = [
  { id: 'warm', name: 'Warm', desc: 'Mature, warm' },
  { id: 'refined', name: 'Refined', desc: 'Soft British' },
  { id: 'gentle', name: 'Gentle', desc: 'Whisper-soft' },
] as const
type VoicePack = (typeof VOICE_PACKS)[number]['id']
// Fallback voice: browser speech synthesis, tuned soft and mature (slightly slower, slightly lower).
const VOICE_PREFS = [
  /\b(Aria|Jenny|Sonia|Libby|Natasha|Clara|Emma|Ava)\b.*(Natural|Online)/i,
  /Google UK English Female/i,
  /\b(Samantha|Serena|Karen|Moira|Tessa|Martha)\b/i,
  /\b(Aria|Jenny|Sonia|Libby|Zira|Hazel|Susan|Catherine)\b/i,
  /female/i,
]
const pickVoice = () => {
  const all = window.speechSynthesis?.getVoices() ?? []
  const en = all.filter((v) => /^en(-|_|$)/i.test(v.lang))
  for (const re of VOICE_PREFS) {
    const v = en.find((x) => re.test(x.name))
    if (v) return v
  }
  return en[0] ?? null
}
const spoken = (t: string) => t.replace(/2×2/g, 'two by two').replace(/…|\.\.\./g, '… ')
const grade = (v: number) => (v >= 95 ? 'S' : v >= 85 ? 'A' : v >= 70 ? 'B' : 'C')
const GOLD = 'linear-gradient(135deg, #FDE68A 0%, #F6C445 40%, #B7791F 100%)'

export function AoiProfile({ onBack, renderFigure, aspect }: { onBack: () => void; renderFigure: (onPoke: () => void, width: number, talking: boolean) => React.ReactNode; aspect: number }) {
  const [line, setLine] = useState<number | null>(null)
  // Fit the full-body figure to the stage height (head to toe always visible).
  const stageRef = useRef<HTMLDivElement>(null)
  const [figW, setFigW] = useState(0)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const fit = () => {
      const h = el.clientHeight - 24
      const w = Math.min(el.clientWidth - 24, h * aspect)
      setFigW(Math.max(120, Math.round(w / 8) * 8))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [aspect])
  const timer = useRef(0)
  const lineRef = useRef<number | null>(null)
  const [talking, setTalking] = useState(false)
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voiceOn, setVoiceOn] = useState(() => {
    try {
      return localStorage.getItem('aoi.voice') !== 'off'
    } catch {
      return true
    }
  })
  const [pack, setPack] = useState<VoicePack>(() => {
    try {
      const v = localStorage.getItem('aoi.voicepack')
      return VOICE_PACKS.some((p) => p.id === v) ? (v as VoicePack) : 'warm'
    } catch {
      return 'warm'
    }
  })
  const voice = useRef<SpeechSynthesisVoice | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const meter = useRef<{ ctx: AudioContext; an: AnalyserNode; buf: Uint8Array<ArrayBuffer>; freq: Uint8Array<ArrayBuffer> } | null>(null)
  const raf = useRef(0)
  // Real lip-sync: publish the clip's loudness on the stage; the avatar rig reads it.
  const pump = () => {
    const m = meter.current
    const el = stageRef.current
    if (!m || !el) return
    m.an.getByteTimeDomainData(m.buf)
    let sum = 0
    for (const v of m.buf) sum += ((v - 128) / 128) ** 2
    const rms = Math.sqrt(sum / m.buf.length)
    // Noise gate + gentle curve so quiet consonants don't flap the jaw.
    el.dataset.lip = Math.pow(Math.min(1, Math.max(0, (rms - 0.018) * 10)), 0.75).toFixed(3)
    // Viseme hint from the spectral centroid (≈300 Hz–3.5 kHz): bright = wide "e/i", dark = round "o/u".
    m.an.getByteFrequencyData(m.freq)
    const hz = m.ctx.sampleRate / m.an.fftSize
    const lo = Math.floor(300 / hz), hi = Math.min(m.freq.length - 1, Math.ceil(3500 / hz))
    let wsum = 0, msum = 0
    for (let i = lo; i <= hi; i++) {
      wsum += m.freq[i] * i * hz
      msum += m.freq[i]
    }
    const centroid = msum > 0 ? wsum / msum : 1200
    el.dataset.form = Math.min(1, Math.max(0, (centroid - 700) / 1300)).toFixed(3)
    raf.current = requestAnimationFrame(pump)
  }
  const stopAudio = () => {
    cancelAnimationFrame(raf.current)
    audio.current?.pause()
    if (stageRef.current) {
      delete stageRef.current.dataset.lip
      delete stageRef.current.dataset.form
    }
    if (canSpeak) speechSynthesis.cancel()
  }
  useEffect(() => {
    const load = () => (voice.current = pickVoice())
    if (canSpeak) {
      load()
      speechSynthesis.addEventListener('voiceschanged', load)
    }
    return () => {
      if (canSpeak) speechSynthesis.removeEventListener('voiceschanged', load)
      stopAudio()
      meter.current?.ctx.close().catch(() => {})
      clearTimeout(timer.current)
    }
  }, [canSpeak])
  const hideLater = (ms: number) => {
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setLine(null)
      setTalking(false)
      lineRef.current = null
    }, ms)
  }
  const speakFallback = (text: string, n: number) => {
    if (!canSpeak) return
    const u = new SpeechSynthesisUtterance(spoken(text))
    if (voice.current) u.voice = voice.current
    u.lang = voice.current?.lang ?? 'en-US'
    u.rate = 0.9
    u.pitch = 0.96
    u.volume = 0.9
    u.onstart = () => {
      setTalking(true)
      // Safety net in case the browser never fires onend.
      hideLater(4000 + text.length * 90)
    }
    u.onend = u.onerror = () => {
      setTalking(false)
      if (lineRef.current === n) hideLater(1400)
    }
    speechSynthesis.speak(u)
  }
  const playClip = (url: string, text: string, n: number) => {
    if (!audio.current) {
      audio.current = new Audio()
      audio.current.preload = 'auto'
    }
    const el = audio.current
    try {
      if (!meter.current) {
        const ctx = new AudioContext()
        const an = ctx.createAnalyser()
        an.fftSize = 1024
        ctx.createMediaElementSource(el).connect(an)
        an.connect(ctx.destination)
        meter.current = { ctx, an, buf: new Uint8Array(an.fftSize), freq: new Uint8Array(an.frequencyBinCount) }
      }
      void meter.current.ctx.resume()
    } catch {}
    el.onplaying = () => {
      setTalking(true)
      hideLater(4000 + (el.duration || text.length / 12) * 1000)
      cancelAnimationFrame(raf.current)
      pump()
    }
    el.onended = () => {
      cancelAnimationFrame(raf.current)
      if (stageRef.current) {
        delete stageRef.current.dataset.lip
        delete stageRef.current.dataset.form
      }
      setTalking(false)
      if (lineRef.current === n) hideLater(1400)
    }
    el.src = url
    el.play().catch(() => {
      setTalking(false)
      speakFallback(text, n)
    })
  }
  const say = (i?: number, usePack: VoicePack = pack) => {
    let n = i ?? Math.floor(Math.random() * AOI_LINES.length)
    if (i === undefined && n === lineRef.current) n = (n + 1) % AOI_LINES.length
    lineRef.current = n
    setLine(n)
    const text = AOI_LINES[n]
    // Fallback timing when the voice is off: ~reading speed.
    hideLater(2200 + text.length * 45)
    stopAudio()
    setTalking(false)
    if (!voiceOn) return
    const url = VOICE_FILES[`./voice/${usePack}/${n}.mp3`]
    if (url) playClip(url, text, n)
    else speakFallback(text, n)
  }
  const choosePack = (id: VoicePack) => {
    setPack(id)
    try {
      localStorage.setItem('aoi.voicepack', id)
    } catch {}
    if (voiceOn) say(2, id)
  }
  const toggleVoice = () => {
    setVoiceOn((v) => {
      const next = !v
      try {
        localStorage.setItem('aoi.voice', next ? 'on' : 'off')
      } catch {}
      if (!next) {
        stopAudio()
        setTalking(false)
      }
      return next
    })
  }
  const panel = 'rounded-2xl border border-t-line bg-t-surface/85 p-4 backdrop-blur-md md:p-5'
  const head = (t: string, sub: string) => (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-extrabold uppercase tracking-[0.14em]">{t}</h2>
      <span className="text-[11px] text-t-muted">{sub}</span>
    </div>
  )
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="relative z-30 flex shrink-0 items-center gap-2 border-b border-t-line bg-t-surface px-3 pb-2 pt-[calc(0.5rem+var(--sa-top))] shadow-elev-1 md:px-6">
        <button type="button" aria-label="Back to chat" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 hover:bg-t-tint/10 active:scale-90">
          <svg {...ico} width={20} height={20}><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[16px] font-bold leading-tight">Character Profile</h1>
          <p className="truncate text-[11px] text-t-muted">AOI · Academic Operations Intelligence</p>
        </div>
      </header>

      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(2rem+var(--sa-bottom))] pt-4 md:px-8 md:pt-6">
        <div className="mx-auto grid w-full max-w-[1120px] gap-4 md:grid-cols-[minmax(0,400px)_1fr] md:gap-6">
          {/* Stage */}
          <section aria-label="AOI full body" className="relative md:sticky md:top-0 md:self-start">
            <div
              ref={stageRef}
              className="aoi-fade-in relative flex h-[560px] items-end justify-center overflow-hidden rounded-[28px] border border-[#B7791F]/50 md:h-[calc(100vh-9rem)] md:max-h-[760px] md:min-h-[560px]"
              style={{ background: 'radial-gradient(120% 70% at 50% 30%, #5a0d16 0%, #2a050a 45%, #0b0507 100%)' }}
            >
              <span aria-hidden className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 26px)' }} />
              <span aria-hidden className="absolute left-1/2 top-[18%] h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-[#B01E2E]/35 blur-[90px]" />
              <span aria-hidden className="pointer-events-none absolute -right-3 top-6 select-none font-black leading-none text-white/[0.06]" style={{ fontSize: 150, writingMode: 'vertical-rl' }}>AOI</span>
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" />

              <div className="absolute left-4 top-4 z-10 flex flex-col items-start gap-1.5">
                <span className="rounded-md px-2.5 py-0.5 text-[22px] font-black italic leading-tight tracking-tight text-[#2a1600] shadow-[0_4px_16px_rgba(246,196,69,0.35)]" style={{ background: GOLD }}>SSR</span>
                <span className="flex gap-0.5" aria-label="Five stars: Latin honors">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#F6C445" aria-hidden><path d="m12 2 3 6.6 7 .8-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.8z" /></svg>
                  ))}
                </span>
                <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#FDE68A]/90">Summa Cum Laude</span>
              </div>
              <div className="absolute right-4 top-4 z-10 text-right text-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Class</p>
                <p className="text-[13px] font-extrabold">Scholar-ship</p>
              </div>

              <div className="relative z-[5] mb-3 flex items-end justify-center">{figW > 0 && renderFigure(() => say(), figW, talking)}</div>

              {/* Secretary-line dialogue box: sits low on the stage so it never covers her face */}
              {line !== null && (
                <div
                  key={line}
                  role="status"
                  aria-live="polite"
                  className="aoi-in absolute inset-x-3 bottom-[72px] z-20 rounded-2xl border border-[#B7791F]/60 bg-[#12070a]/85 px-4 pb-3 pt-2.5 text-white shadow-[0_12px_30px_rgba(0,0,0,0.5)] backdrop-blur-md"
                >
                  <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#FDE68A]">
                    AOI
                    {talking && (
                      <span className="flex items-end gap-0.5" aria-hidden>
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="aoi-wave h-2.5 w-0.5 rounded-full bg-[#FDE68A]" style={{ animationDelay: `${i * 0.12}s` }} />
                        ))}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-[13.5px] font-medium leading-snug">{AOI_LINES[line]}</p>
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-4 pb-3 text-white">
                <div>
                  <p className="text-[28px] font-black leading-none tracking-tight">AOI</p>
                  <p className="mt-1 text-[11px] font-medium text-white/70">aoi-scholar · MSU–ZS</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-medium text-white/60">Tap her to talk</p>
                  {(
                    <button
                      type="button"
                      onClick={toggleVoice}
                      aria-pressed={voiceOn}
                      aria-label={voiceOn ? 'Mute AOI’s voice' : 'Unmute AOI’s voice'}
                      title={voiceOn ? 'Voice on' : 'Voice off'}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white transition-colors hover:bg-white/15"
                    >
                      <svg {...ico} width={15} height={15}>
                        <path d="M11 5 6 9H3v6h3l5 4z" />
                        {voiceOn ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 5 6M21 9l-5 6" />}
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Info */}
          <div className="flex min-w-0 flex-col gap-4">
            <section className={`${panel} aoi-in`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold text-[#2a1600]" style={{ background: GOLD }}>SSR · Summa Cum Laude</span>
                <span className="rounded-full border border-[#800000]/60 bg-[#800000]/15 px-2.5 py-0.5 text-[11px] font-bold text-t-accent">Scholar-ship</span>
                <span className="rounded-full border border-t-line2 px-2.5 py-0.5 text-[11px] font-semibold text-t-soft">Faction: MSU–Zamboanga Sibugay</span>
              </div>
              <h2 className="mt-3 text-[28px] font-black leading-tight tracking-tight md:text-[34px]">AOI</h2>
              <p className="text-[13.5px] text-t-muted">Academic Operations Intelligence · Campus AI Assistant</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ['Lv. 125', 'Units earned'],
                  ['1.00', 'GWA'],
                  ['100', "Affinity · Dean's Lister"],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-xl border border-t-line bg-t-tint/5 px-3 py-2.5">
                    <p className="font-mono text-[20px] font-bold leading-none text-t-accent">{v}</p>
                    <p className="mt-1 text-[11px] leading-tight text-t-muted">{l}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className={`${panel} aoi-in`} style={{ animationDelay: '0.05s' }} aria-label="Stats">
              {head('Stats', 'Graded on the S–C scale')}
              <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {AOI_STATS.map((st) => {
                  const g = grade(st.value)
                  return (
                    <li key={st.key} title={st.note}>
                      <div className="flex items-center gap-2">
                        <span className="w-9 shrink-0 font-mono text-[11px] font-bold text-t-muted">{st.key}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{st.name}</span>
                        <span className="font-mono text-[12px] text-t-soft">{st.value}</span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-black ${g === 'S' ? 'text-[#2a1600]' : g === 'A' ? 'bg-[#800000] text-white' : 'bg-t-tint/15 text-t-soft'}`}
                          style={g === 'S' ? { background: GOLD } : undefined}
                        >
                          {g}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-t-tint/10">
                        <div className="h-full rounded-full" style={{ width: `${st.value}%`, background: g === 'S' ? GOLD : 'linear-gradient(90deg, #4a0000, #B01E2E)' }} />
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-t-muted">{st.note}</p>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className={`${panel} aoi-in`} style={{ animationDelay: '0.1s' }} aria-label="Skills">
              {head('Skills', 'Mapped to real AOI features')}
              <ul className="flex flex-col gap-2.5">
                {AOI_SKILLS.map((sk) => (
                  <li key={sk.name} className="flex gap-3 rounded-xl border border-t-line bg-t-tint/5 p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: 'linear-gradient(145deg, #B01E2E, #4a0000)' }}>
                      <svg {...ico} width={20} height={20}>{sk.icon}</svg>
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold">
                        {sk.name}
                        <span className={`rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.08em] ${sk.kind === 'Active' ? 'bg-[#800000] text-white' : 'border border-t-line2 text-t-muted'}`}>{sk.kind}</span>
                      </p>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-t-muted">{sk.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className={`${panel} aoi-in`} style={{ animationDelay: '0.15s' }} aria-label="Syllabus loadout">
              {head('Syllabus Loadout', 'Equipped')}
              <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                {AOI_LOADOUT.map(([slot, name, sub]) => (
                  <li key={slot} className="rounded-xl border border-dashed border-[#B7791F]/50 bg-t-tint/5 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-t-muted">{slot}</p>
                    <p className="mt-1 text-[13px] font-bold leading-snug">{name}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-t-muted">{sub}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className={`${panel} aoi-in`} style={{ animationDelay: '0.2s' }} aria-label="Dossier">
              {head('Dossier', 'Registrar-certified')}
              <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2 text-[13px]">
                <dt className="text-t-muted">Code name</dt><dd className="font-mono">aoi-scholar</dd>
                <dt className="text-t-muted">Enrolled</dt><dd>MSU–Zamboanga Sibugay · every program, auditing</dd>
                <dt className="text-t-muted">Likes</dt><dd>Well-cited sources, quiet library hours, CHED memos with page numbers</dd>
                <dt className="text-t-muted">Dislikes</dt><dd>Plagiarism, unread handbooks, “pa-copy po” requests</dd>
                <dt className="text-t-muted">Motto</dt><dd className="font-semibold italic">“Cite first, answer second.”</dd>
              </dl>
            </section>

            <section className={`${panel} aoi-in`} style={{ animationDelay: '0.25s' }} aria-label="Secretary lines">
              {head('Secretary Lines', voiceOn ? 'Tap to hear her voice' : 'Voice muted')}
              <div role="radiogroup" aria-label="AOI voice" className="mb-3 grid grid-cols-3 gap-1.5 rounded-xl border border-t-line bg-t-tint/5 p-1">
                {VOICE_PACKS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={pack === v.id}
                    onClick={() => choosePack(v.id)}
                    className={`rounded-lg px-2 py-1.5 text-left transition-colors ${pack === v.id ? 'bg-[#800000] text-white' : 'hover:bg-t-tint/10'}`}
                  >
                    <span className="block text-[12.5px] font-bold">{v.name}</span>
                    <span className={`block text-[10.5px] ${pack === v.id ? 'text-white/75' : 'text-t-muted'}`}>{v.desc}</span>
                  </button>
                ))}
              </div>
              <ul className="flex flex-col gap-1.5">
                {AOI_LINES.map((l, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => say(i)}
                      aria-pressed={line === i}
                      className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${line === i ? 'bg-[#800000] text-white' : 'hover:bg-t-tint/10'}`}
                    >
                      <svg {...ico} width={14} height={14} className="mt-0.5 shrink-0"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>
                      <span>{l}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-t-subtle">Voice lines generated with Kokoro TTS (open source, Apache-2.0).</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
