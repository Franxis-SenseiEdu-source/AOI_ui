import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import msuLogo from './msu-logo.png'
import portalBg from './portal-bg.mp4'

export type Role = 'Student' | 'Faculty' | 'Staff' | 'Admin'
export type View = 'login' | 'account' | 'about' | 'research' | 'portal' | 'chat' | 'audit' | 'policies'
export type AuditRow = { cid: string; ts: number; role: Role; intent: string; model: string; path: string; external: boolean; degraded: boolean; user?: string }

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
  const r = (cid: string, ago: number, role: Role, intent: string, model: string, path: string, external = false, degraded = false): AuditRow => ({ cid, ts: now - ago, role, intent, model, path, external, degraded })
  return [
    r('aoi-7x9f2', 2 * D, 'Student', 'Policy', 'AOI Policy', 'Local RAG'),
    r('aoi-m3k8q', 3 * D, 'Student', 'Research', 'External LLM (anonymized)', 'PII Stripper → External', true),
    r('aoi-b4n6w', 41 * MIN, 'Faculty', 'Policy', 'AOI Policy', 'Local RAG'),
    r('aoi-t8c2d', 58 * MIN, 'Student', 'General', 'AOI General', 'Local LLM'),
    r('aoi-h5r9e', 95 * MIN, 'Staff', 'Policy', 'AOI Policy', 'Local RAG'),
    r('aoi-k2v7s', 2.4 * 60 * MIN, 'Student', 'Homework (refused)', 'None (rule-based)', 'Policy Guard → Refused'),
    r('aoi-p9x3f', 3.1 * 60 * MIN, 'Faculty', 'Research', 'External LLM (anonymized)', 'PII Stripper → External', true),
    r('aoi-w6j4n', 5 * 60 * MIN, 'Student', 'General', 'AOI Local Fallback', 'Local fallback', false, true),
    r('aoi-d3q8m', 7 * 60 * MIN, 'Student', 'Policy', 'AOI Local Fallback', 'Local fallback', false, true),
    r('aoi-z7e5y', 9 * 60 * MIN, 'Staff', 'Research', 'External LLM (anonymized)', 'PII Stripper → External', true),
    r('aoi-g4s2c', 1 * D + 3 * 60 * MIN, 'Student', 'General', 'AOI General', 'Local LLM'),
    r('aoi-n8u6a', 1 * D + 6 * 60 * MIN, 'Faculty', 'Policy', 'AOI Policy', 'Local RAG'),
  ]
}

export type SourceDoc = { title: string; external: boolean; ref: string; snippet: string; docId?: string; score: number; chunk: string }

export const SOURCE_DOCS: Record<string, SourceDoc> = {
  'Student Handbook p.12': {
    title: 'Student Handbook 2025–2026',
    external: false,
    ref: 'Admission & Enrollment · p.12',
    docId: 'handbook',
    score: 0.94,
    chunk: 'handbook#c12-3',
    snippet:
      'Freshmen applicants must submit the following: (a) Form 138 or Report Card, (b) Certificate of Good Moral Character, (c) PSA-issued Birth Certificate, and (d) two (2) recent 2×2 photographs. Incomplete submissions will not be processed by the Registrar.',
  },
  'Registrar Memo 2025-04': {
    title: 'Registrar Memo 2025-04 · Enrollment Schedule',
    external: false,
    ref: 'Office of the Registrar · p.1',
    docId: 'memo',
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

export type PolicyDoc = { id: string; title: string; office: string; category: string; pages: number; updated: string; size: string; body: { n: number; paras: string[] }[] }

export const DOCS: PolicyDoc[] = [
  {
    id: 'handbook',
    title: 'Student Handbook 2025–2026',
    office: 'Office of Student Affairs',
    category: 'Student Life',
    pages: 84,
    updated: 'Jun 2025',
    size: '3.2 MB',
    body: [
      {
        n: 12,
        paras: [
          'Admission and Enrollment. All applicants are admitted subject to verification of credentials by the Office of the Registrar.',
          SOURCE_DOCS['Student Handbook p.12'].snippet,
          'Transferees must additionally present an Honorable Dismissal and a Transcript of Records for evaluation and crediting of units.',
        ],
      },
      { n: 13, paras: ['Students are expected to settle assessed fees before the end of the first week of classes. Installment plans are available through the Accounting Office.'] },
    ],
  },
  {
    id: 'memo',
    title: 'Registrar Memo 2025-04 · Enrollment Schedule',
    office: 'Office of the Registrar',
    category: 'Enrollment',
    pages: 3,
    updated: 'Apr 2025',
    size: '410 KB',
    body: [{ n: 1, paras: ['To: All Deans, Department Chairs and Students.', SOURCE_DOCS['Registrar Memo 2025-04'].snippet, 'Late enrollment is allowed until the end of the add/drop period upon payment of the prescribed surcharge.'] }],
  },
  {
    id: 'tuition',
    title: 'Tuition & Fees Schedule AY 2025–2026',
    office: 'Accounting Office',
    category: 'Finance',
    pages: 6,
    updated: 'May 2025',
    size: '620 KB',
    body: [{ n: 1, paras: ['Tuition for state-funded undergraduate programs is free under RA 10931 for qualified students. Miscellaneous and laboratory fees remain payable per unit schedule.', 'Students who are not covered by free tuition are assessed per unit, with a 5% discount for full payment on or before the first day of classes.'] }],
  },
  {
    id: 'grading',
    title: 'Grading System & Grade Appeals Policy',
    office: 'Office of the VP for Academic Affairs',
    category: 'Academics',
    pages: 11,
    updated: 'Aug 2024',
    size: '880 KB',
    body: [{ n: 5, paras: ['A student who disputes a final grade shall first raise the concern with the instructor within ten (10) working days after grades are released.', 'If unresolved, the student may file a written appeal with the Department Chair, then the College Dean, whose decision is final.'] }],
  },
  {
    id: 'scholarship',
    title: 'Scholarship & Financial Assistance Guidelines',
    office: 'Scholarship Office',
    category: 'Finance',
    pages: 14,
    updated: 'Jul 2025',
    size: '1.1 MB',
    body: [{ n: 3, paras: ['Eligibility. Applicants must maintain a general weighted average of 2.0 or better with no failing or incomplete grades in the preceding term.', 'Renewal is evaluated each semester. Scholars who fall below the retention GPA are placed on probation for one term.'] }],
  },
  {
    id: 'privacy',
    title: 'Data Privacy Manual (RA 10173)',
    office: 'Data Protection Office',
    category: 'Compliance',
    pages: 22,
    updated: 'Jan 2025',
    size: '1.8 MB',
    body: [{ n: 8, paras: ['Personal data may not leave the University’s systems unless identifying information has been removed and the data subject has given informed consent.', 'All processing of personal data is logged with a correlation identifier to support audit and breach investigation.'] }],
  },
]

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
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!email.trim() || !idn.trim()) {
      setErr('Please enter your credentials.')
      return
    }
    setErr('')
    setBusy(true)
    window.setTimeout(() => onLogin(email, idn), 1400)
  }
  const field = 'mt-1.5 w-full rounded-xl border bg-white/[0.06] px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none transition-colors duration-200 focus:border-[#E5707E] focus:bg-white/[0.09]'
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
            <span className="flex items-center gap-1 text-[30px] font-extrabold tracking-tight">
              AOI
              <span className="mt-2 h-2 w-2 rounded-full bg-[#B01E2E]" />
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
                  <span className="block text-[13px] text-white/60">{d}</span>
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
            autoComplete="username"
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
            value={idn}
            disabled={busy}
            onChange={(e) => { setIdn(e.target.value); setErr('') }}
            placeholder="100XXXX"
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
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-white/45">
          <svg {...ico} width={12} height={12}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
          Your role is assigned automatically from your institutional account.
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
  counts: { chats: number; queries: number; docs: number }
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
    { label: 'Policy documents', value: counts.docs, view: 'policies' as View },
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
      <header className="relative z-30 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-t-line bg-t-surface px-4 pb-2.5 pt-[calc(0.625rem+var(--sa-top))] shadow-[0_4px_20px_rgba(0,0,0,0.3)] md:px-8">
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
          className="order-2 ml-auto flex items-center gap-1.5 rounded-full border border-t-line2 px-3 py-1.5 text-[13px] font-semibold transition-colors duration-200 hover:border-[#800000] hover:bg-[#800000] hover:text-white active:scale-95 md:order-3 md:ml-0"
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
          style={{ background: 'linear-gradient(115deg, rgba(58,0,0,0.78) 0%, rgba(128,0,0,0.62) 55%, rgba(90,10,20,0.78) 100%)' }}
        >
          <span aria-hidden className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 22px)' }} />
          <span aria-hidden className="absolute -right-10 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-sky-300/25 blur-3xl" />
          <div className="relative mx-auto flex w-full max-w-[1040px] items-center justify-between gap-3 px-4 pt-6 md:px-8 md:pt-9">
            <div className="min-w-0 pb-4 md:pb-6">
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
            <div className="relative -mb-px shrink-0 self-end">{avatar}</div>
          </div>
          <div className="relative mx-auto w-full max-w-[1040px] px-4 pb-6 md:px-8 md:pb-8">
              <form
                className={`flex max-w-[520px] items-center gap-1.5 rounded-full border bg-black/25 p-1 pl-4 backdrop-blur-sm focus-within:border-white/60 ${askErr ? 'border-red-300' : 'border-white/25'}`}
                onSubmit={(e) => { e.preventDefault(); if (ask.trim()) onAsk(ask.trim()); else setAskErr(true) }}
              >
                <input
                  value={ask}
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
              <button key={x.label} type="button" onClick={() => onOpen(x.view)} className="rounded-xl border border-t-line bg-t-surface px-3 py-3 text-left transition-colors hover:border-[#800000] active:scale-[0.98] md:px-4">
                <span className="block font-mono text-[22px] font-bold leading-none text-t-accent md:text-[28px]">{x.value}</span>
                <span className="mt-1.5 block text-[11px] leading-tight text-t-muted md:text-[12.5px]">{x.label}</span>
              </button>
            ))}
          </div>

          <section className="mt-8" aria-label="Academic Services">
            <SectionHead n="01" title="Academic Services" sub="Institutional records and enrollment" />
            <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3 lg:grid-cols-3">
              {SERVICES.filter((s) => s.title !== 'My Grades' || role === 'Student').map((s) => {
                const cls = 'group flex items-center gap-3 rounded-lg border border-t-line bg-t-surface px-4 py-3 text-left transition-colors duration-200 hover:border-[#800000] hover:bg-t-tint/5 active:scale-[0.99]'
                const inner = (
                  <>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#800000]/25 text-t-accent">
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
                  className={`aoi-in group flex flex-col items-start gap-3 rounded-[20px] border p-5 text-left transition-all duration-200 ease-in-out hover:-translate-y-1 active:scale-[0.98] ${c.primary ? 'border-[#B01E2E]/60 text-white shadow-[0_10px_30px_rgba(128,0,0,0.45)]' : 'border-t-tint/10 bg-t-surface/70 shadow-[0_6px_20px_rgba(0,0,0,0.25)] backdrop-blur-md hover:border-[#800000]'}`}
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
            <ul className="mt-3 divide-y divide-t-line overflow-hidden rounded-lg border border-t-line bg-t-surface">
              {ANNOUNCEMENTS.filter((a) => tag === 'All' || a.tag === tag).map((a) => {
                const [mon, day] = a.date.split(' ')
                return (
                  <li key={a.title} className="flex gap-4 px-4 py-4 md:px-5">
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-[#800000] text-white">
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

const Yes = () => <span className="inline-flex items-center gap-1.5 rounded-full bg-[#800000] px-2 py-0.5 text-[11px] font-bold text-white"><span className="h-1.5 w-1.5 rounded-full bg-white" />Yes</span>
const No = () => <span className="inline-flex items-center rounded-full bg-t-tint/10 px-2 py-0.5 text-[11px] font-semibold text-t-muted">No</span>

export function AuditLog({ rows, onHome, focusCid, admin }: { rows: AuditRow[]; onHome: () => void; focusCid: string | null; admin: boolean }) {
  const [filter, setFilter] = useState<'all' | 'external' | 'degraded'>('all')
  const [q, setQ] = useState('')
  const total = rows.length
  const ext = rows.filter((r) => r.external).length
  const deg = rows.filter((r) => r.degraded).length
  const list = rows.filter((r) => (filter === 'all' || (filter === 'external' ? r.external : r.degraded)) && (!q || r.cid.includes(q.toLowerCase().trim())))
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
      <header className="relative z-30 flex shrink-0 items-center gap-2 border-b border-t-line bg-t-surface px-3 pb-2 pt-[calc(0.5rem+var(--sa-top))] shadow-[0_4px_20px_rgba(0,0,0,0.3)] md:px-6">
        <BackBtn onClick={onHome} label="Back to Portal" />
        <div className="min-w-0">
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
            <span className="text-t-warn">Degraded Events: <b className="font-mono text-[15px]">{deg}</b></span>
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(['all', 'external', 'degraded'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold capitalize transition-all duration-200 ${filter === f ? 'border-[#800000] bg-[#800000] text-white' : 'border-t-line2 bg-t-line text-t-soft hover:brightness-95'}`}
              >
                {f === 'all' ? 'All' : f === 'external' ? 'External only' : 'Degraded only'}
              </button>
            ))}
            <label className="ml-auto flex h-9 min-w-[160px] flex-1 items-center gap-2 rounded-full border border-t-line bg-t-input px-3 focus-within:border-[#800000] md:max-w-[240px] md:flex-none">
              <svg {...ico} width={14} height={14}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find ID…" aria-label="Find correlation ID" className="min-w-0 flex-1 bg-transparent font-mono text-[12px] outline-none placeholder:text-t-subtle" />
            </label>
          </div>

          <div className="mt-4 hidden overflow-hidden rounded-2xl border border-t-tint/10 bg-t-surface/80 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-md md:block">
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
                        {r.degraded && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-t-warn align-middle" title="Degraded" />}
                        {r.path}
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
                  <dt className="text-t-muted">Path</dt><dd>{r.degraded && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-t-warn align-middle" />}{r.path}</dd>
                </dl>
              </li>
            ))}
          </ul>
          {!list.length && <p className="py-10 text-center text-[13px] text-t-subtle">No matching entries.</p>}
          <p className="mt-4 flex items-center gap-2 text-[11.5px] text-t-muted">
            <span className="inline-block h-3 w-5 rounded bg-[#800000]/40" /> Highlighted rows left the Data Sovereignty Boundary (anonymized external call).
          </p>
        </div>
      </main>
    </div>
  )
}

const PdfIcon = () => (
  <svg {...ico} width={22} height={22}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </svg>
)

export function PolicyLibrary({ openId, setOpenId, highlight, onHome, onToast }: { openId: string | null; setOpenId: (id: string | null) => void; highlight: string | null; onHome: () => void; onToast: (t: string) => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const cats = ['All', ...Array.from(new Set(DOCS.map((d) => d.category)))]
  const doc = DOCS.find((d) => d.id === openId)
  const list = DOCS.filter((d) => (cat === 'All' || d.category === cat) && d.title.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="relative z-30 flex shrink-0 items-center gap-2 border-b border-t-line bg-t-surface px-3 pb-2 pt-[calc(0.5rem+var(--sa-top))] shadow-[0_4px_20px_rgba(0,0,0,0.3)] md:px-6">
        <BackBtn onClick={doc ? () => setOpenId(null) : onHome} label={doc ? 'Back to library' : 'Back to Portal'} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-bold leading-tight">{doc ? doc.title : 'University Policies'}</h1>
          <p className="truncate text-[11px] text-t-muted">{doc ? `${doc.office} · ${doc.pages} pages · ${doc.size}` : 'Official documents indexed for AOI answers'}</p>
        </div>
        {doc && (
          <button type="button" onClick={() => onToast('Download started (mock)')} className="flex h-9 items-center gap-1.5 rounded-full border border-t-line2 bg-t-line px-3 text-[12px] font-semibold transition-all hover:brightness-95 active:scale-95">
            <svg {...ico} width={14} height={14}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>
            PDF
          </button>
        )}
      </header>
      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(2rem+var(--sa-bottom))] pt-5 md:px-8 md:pt-8">
        {doc ? (
          <div key={doc.id} className="aoi-fade-in mx-auto flex w-full max-w-[720px] flex-col gap-4">
            {doc.body.map((pg) => (
              <article key={pg.n} className="rounded-xl bg-white p-6 text-[13.5px] leading-relaxed text-neutral-800 shadow-[0_10px_30px_rgba(0,0,0,0.35)] md:p-10 md:text-[14.5px]">
                <p className="mb-3 border-b border-neutral-200 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">{doc.title} · Page {pg.n}</p>
                {pg.paras.map((p) => (
                  <p key={p} className={`mt-3 ${p === highlight ? '-mx-2 rounded-md bg-[#800000]/12 px-2 py-1 shadow-[inset_3px_0_0_#800000]' : ''}`}>{p}</p>
                ))}
              </article>
            ))}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[1040px]">
            <div className="flex flex-wrap items-center gap-2">
              {cats.map((c) => (
                <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all ${cat === c ? 'border-[#800000] bg-[#800000] text-white' : 'border-t-line2 bg-t-line text-t-soft hover:brightness-95'}`}>
                  {c}
                </button>
              ))}
              <label className="ml-auto flex h-9 min-w-[160px] flex-1 items-center gap-2 rounded-full border border-t-line bg-t-input px-3 focus-within:border-[#800000] md:max-w-[260px] md:flex-none">
                <svg {...ico} width={14} height={14}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents" aria-label="Search documents" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-t-subtle" />
              </label>
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {list.map((d, i) => (
                <li key={d.id} style={{ animationDelay: `${i * 0.05}s` }} className="aoi-in">
                  <button type="button" onClick={() => setOpenId(d.id)} className="group flex h-full w-full items-start gap-3 rounded-2xl border border-t-tint/10 bg-t-surface/70 p-4 text-left backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-[#800000] active:scale-[0.98]">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#800000]/30 text-t-accent group-hover:bg-[#800000]/60 group-hover:text-t-fg"><PdfIcon /></span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-t-accent">{d.category}</span>
                      <span className="mt-0.5 block text-[14px] font-semibold leading-snug">{d.title}</span>
                      <span className="mt-1 block text-[12px] text-t-muted">{d.office}</span>
                      <span className="mt-2 block font-mono text-[11px] text-t-subtle">PDF · {d.pages} pp · {d.size} · {d.updated}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!list.length && <p className="py-10 text-center text-[13px] text-t-subtle">No documents match.</p>}
          </div>
        )}
      </main>
    </div>
  )
}

export function SourceSheet({ label, onClose, onView }: { label: string | null; onClose: () => void; onView: (label: string) => void }) {
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
        className={`relative w-full rounded-t-[24px] border-t border-t-tint/10 bg-t-deep px-5 pt-3 text-t-fg shadow-[0_-12px_40px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:max-w-[560px] ${open ? 'translate-y-0' : 'translate-y-full'}`}
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
              onClick={() => onView(shown)}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] font-semibold text-white shadow-[0_0_15px_rgba(128,0,0,0.4)] transition-all duration-200 hover:brightness-125 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #800000, #600000)' }}
            >
              <PdfIcon />
              View Full Document
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function synthRow(cid: string, ts: number, role: Role, m: { text: string; external?: boolean; sources?: string[]; warn?: boolean }): AuditRow {
  const homework = m.text.startsWith("I can't help with homework")
  const error = m.text.startsWith('Sorry, something went wrong')
  const intent = homework ? 'Homework (refused)' : error ? 'Error' : m.external ? 'Research' : m.sources ? 'Policy' : 'General'
  if (m.warn) return { cid, ts, role, intent, model: 'AOI Local Fallback', path: 'Local fallback', external: false, degraded: true }
  if (homework) return { cid, ts, role, intent, model: 'None (rule-based)', path: 'Policy Guard → Refused', external: false, degraded: false }
  if (error) return { cid, ts, role, intent, model: 'None', path: 'Error handler', external: false, degraded: false }
  if (m.external) return { cid, ts, role, intent, model: 'External LLM (anonymized)', path: 'PII Stripper → External', external: true, degraded: false }
  return { cid, ts, role, intent, model: m.sources ? 'AOI Policy' : 'AOI General', path: m.sources ? 'Local RAG' : 'Local LLM', external: false, degraded: false }
}

export type User = { name: string; email: string; id: string; role: Role }
export const roleFor = (email: string, id: string): Role => {
  const e = email.toLowerCase(), i = id.toUpperCase()
  if (/^adm/.test(i) || /admin/.test(e)) return 'Admin'
  if (/^stf|^s-/.test(i) || /(staff|registrar|office|ict)/.test(e)) return 'Staff'
  if (/^fac|^f-/.test(i) || /(prof|faculty|instructor|dr\.)/.test(e)) return 'Faculty'
  return 'Student'
}
export const userFrom = (email: string, id: string): User => {
  const local = email.split('@')[0] || 'student'
  const name = local.split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') || 'Student'
  return { name, email: email.trim(), id: id.trim(), role: roleFor(email, id) }
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
      <header className="relative z-30 flex shrink-0 items-center gap-2 border-b border-t-line bg-t-surface px-3 pb-2 pt-[calc(0.5rem+var(--sa-top))] shadow-[0_4px_20px_rgba(0,0,0,0.3)] md:px-6">
        <BackBtn onClick={onHome} label="Back to Portal" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-bold leading-tight">Account Settings</h1>
          <p className="truncate text-[11px] text-t-muted">Profile, appearance and session</p>
        </div>
        <button type="button" onClick={onSignOut} className="flex h-9 items-center gap-1.5 rounded-full border border-t-line2 px-3 text-[13px] font-semibold transition-colors hover:border-[#800000] hover:bg-[#800000] hover:text-white active:scale-95">
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
            <button type="button" onClick={onReset} className="h-11 flex-1 rounded-[12px] border border-t-line2 bg-t-line text-[14px] font-semibold transition-all hover:brightness-95 active:scale-[0.98]">Reset preferences</button>
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
  { tier: 'Tier 3', name: 'External Synthesis', sub: 'research-general', model: 'OpenRouter free tier', where: 'external', rule: 'Needs multi-source integration, or degraded-mode fallback', out: 'External multi-source integrated result', bar: 'bg-rose-500' },
]

const SubHeader = ({ title, sub, onHome }: { title: string; sub: string; onHome: () => void }) => (
  <header className="relative z-30 flex shrink-0 items-center gap-2 border-b border-t-line bg-t-surface px-3 pb-2 pt-[calc(0.5rem+var(--sa-top))] shadow-[0_4px_20px_rgba(0,0,0,0.3)] md:px-6">
    <BackBtn onClick={onHome} label="Back to Portal" />
    <div className="min-w-0">
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
    { n: 'Degraded mode', d: 'If a local model is unavailable, AOI says so clearly and falls back safely.' },
  ]
  const pillars = [
    ['Data sovereignty', 'Queries stay on university systems unless you approve an anonymized external lookup.'],
    ['Privacy by design', 'A PII Stripper removes names, IDs, emails and course codes before anything leaves.'],
    ['Traceable', 'Every answer carries a correlation ID that links to the audit log.'],
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
            {pillars.map(([t, d]) => (
              <div key={t} className="rounded-xl border border-t-line bg-t-surface p-4">
                <p className="text-[14px] font-bold">{t}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-t-muted">{d}</p>
              </div>
            ))}
          </div>

          <h3 className="mt-9 border-b-2 border-[#800000] pb-2 text-[17px] font-extrabold">How AOI routes your question</h3>
          <ol className="mt-3 divide-y divide-t-line overflow-hidden rounded-lg border border-t-line bg-t-surface">
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
            <svg {...ico} width={14} height={14} className="mt-0.5 shrink-0"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" /></svg>
            <span><b className="text-t-fg">Degraded mode:</b> if a local model is unavailable, the request also falls through to the gate and Tier 3. Every external call is flagged in the audit log.</span>
          </p>

          <h3 className="mt-9 border-b-2 border-[#800000] pb-2 text-[17px] font-extrabold">Start a research chat</h3>
          <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {prompts.map((p) => (
              <button key={p.title} type="button" onClick={() => onStart(p.prompt)} className="group flex min-w-0 items-center justify-between gap-3 rounded-lg border border-t-line bg-t-surface px-4 py-3 text-left transition-colors hover:border-[#800000] active:scale-[0.99]">
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
