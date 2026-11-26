import type React from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import aoiArt from './aoi-l2d.webp'
import aoiBodyArt from './aoi-body.webp'
import { AoiProfile, AuditLog, HISTORY, HomeIcon, legacyCid, Login, AboutAOI, ResearchHub, AccountSettings, userFrom, initials, newCid, Portal, SOURCE_DOCS, SourceSheet, synthRow } from './views'
import type { AuditRow, Role, User, View } from './views'

type AvatarState = 'idle' | 'listening' | 'processing' | 'responding' | 'error'

type Msg = {
  id: number
  files?: string[]
  rating?: 'up' | 'down'
  role: 'user' | 'aoi'
  text: string
  sources?: string[]
  external?: boolean
  cid?: string
  time: string
  // Set when the reply failed; the bubble shows a fix-it action instead of an answer.
  error?: 'config' | 'network' | 'server'
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

const HONORIFIC = '(?:Prof\\.?|Professor|Dr\\.?|Mr\\.?|Ms\\.?|Mrs\\.?)'
const SUBJECTS: Record<string, string> = { CS: 'computer science', IT: 'information technology', MATH: 'mathematics', ENG: 'English', BIO: 'biology', CHEM: 'chemistry', PHYS: 'physics', PE: 'physical education', NSTP: 'national service' }
const COURSE_RE = /\[?\b([A-Z]{2,5})\s?\d{3}\b\]?/g
const PII_PATTERNS: { re: RegExp; layer: 1 | 2 }[] = [
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/g, layer: 1 },
  { re: /\b\d{2}-\d{4,6}\b/g, layer: 1 },
  { re: /\b(\+?63|0)9\d{9}\b/g, layer: 1 },
  { re: new RegExp(`\\[?\\b${HONORIFIC}\\s+[A-Z][a-z]+\\]?`, 'g'), layer: 1 },
  { re: /\b(my name is|i am|i'm)\s+[A-Z][a-z]+(\s[A-Z][a-z]+)?/g, layer: 1 },
  { re: /MSU[-\s]?Zamboanga Sibugay( University)?|MSU-ZSU/gi, layer: 1 },
  { re: COURSE_RE, layer: 2 },
]

function detectPII(t: string): { text: string; layer?: 1 | 2 }[] {
  const hits: { s: number; e: number; layer: 1 | 2 }[] = []
  for (const { re, layer } of PII_PATTERNS) {
    for (const m of t.matchAll(new RegExp(re.source, re.flags))) hits.push({ s: m.index!, e: m.index! + m[0].length, layer })
  }
  hits.sort((a, b) => a.s - b.s)
  const out: { text: string; layer?: 1 | 2 }[] = []
  let at = 0
  for (const h of hits) {
    if (h.s < at) continue
    if (h.s > at) out.push({ text: t.slice(at, h.s) })
    out.push({ text: t.slice(h.s, h.e), layer: h.layer })
    at = h.e
  }
  if (at < t.length) out.push({ text: t.slice(at) })
  return out
}

function anonymize(t: string) {
  return t
    .replace(new RegExp(`\\s+from\\s+\\[?${HONORIFIC}\\s+[A-Z][a-z]+\\]?`, 'g'), '')
    .replace(new RegExp(`\\[?\\b${HONORIFIC}\\s+[A-Z][a-z]+\\]?`, 'g'), 'my instructor')
    .replace(COURSE_RE, (_, p: string) => `a ${SUBJECTS[p] ?? 'university'} course`)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/(?:\+?63|\b0)[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, '[phone]')
    .replace(/\b(?:[A-Za-z]{1,3}-)?\d{4}-\d{4,6}\b/g, '[student ID]')
    .replace(/\b\d{2}-\d{4,6}\b/g, '[student ID]')
    .replace(/\b\d{7,10}\b/g, '[ID number]')
    .replace(/MSU[-\s]?Zamboanga Sibugay( University)?|MSU-ZSU/gi, 'a regional state university')
    .replace(/\b(my name is|i am|i'm)\s+[A-Z][a-z]+(\s[A-Z][a-z]+)?/g, '$1 [name]')
}

// ---- Live2D-style rig -------------------------------------------------------------
// One shared rAF loop drives every mounted avatar by writing CSS variables
// (--ax/--ay head angle, --az roll, --hair physics, --eye openness, --lip, --br breath).
// Layers move by different amounts per unit of angle, which fakes a 3D head turn.
type RigState = {
  ax: number; ay: number; az: number; hair: number; hairV: number; lip: number; lipT: number; lipAt: number; form: number; formT: number
  blinkAt: number; blinkStart: number; blinkTwice: boolean; phase: number; rect: DOMRect | null; rectAge: number
  ex: Expr; grinAt: number; grinUntil: number
}
// Expression parameters (0..1 unless noted): eye-smile squint, eye widen, mouth corners (-1 frown..1 smile),
// round "o" mouth, blush, eyelid cap (1 = fully open allowed).
type Expr = { smile: number; wide: number; mouth: number; o: number; blush: number; lid: number }
type Mood = 'idle' | 'listen' | 'think' | 'talk' | 'sad' | 'happy'
const MOODS: Record<Mood, Expr> = {
  idle: { smile: 0.12, wide: 0, mouth: 0.35, o: 0, blush: 0.2, lid: 1 },
  listen: { smile: 0, wide: 0.45, mouth: 0.15, o: 0.12, blush: 0.25, lid: 1 },
  think: { smile: 0, wide: 0, mouth: -0.1, o: 0.3, blush: 0.1, lid: 0.8 },
  talk: { smile: 0.3, wide: 0.1, mouth: 0.55, o: 0, blush: 0.3, lid: 1 },
  sad: { smile: 0, wide: 0, mouth: -0.9, o: 0, blush: 0, lid: 0.68 },
  happy: { smile: 1, wide: 0, mouth: 1, o: 0, blush: 0.85, lid: 1 },
}
const rigEls = new Map<HTMLElement, RigState>()
type RigPose = { ax: number; ay: number; az: number; hair: number; eye: number; lip: number; form: number; br: number; t: number } & Expr
const rigDraw = new WeakMap<HTMLElement, (p: RigPose) => void>()
const pointer = { x: 0, y: 0, at: -1e9 }
let rigRaf = 0
let rigLast = 0
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const rigFrame = (t: number) => {
  const dt = Math.min(0.05, (t - (rigLast || t)) / 1000) || 0.016
  rigLast = t
  const sec = t / 1000
  const idle = t - pointer.at > 2500
  // While the user types, she glances at the focused text field.
  const ae = document.activeElement as HTMLElement | null
  const field = idle && ae && (ae.tagName === 'TEXTAREA' || (ae.tagName === 'INPUT' && (ae as HTMLInputElement).type === 'text')) ? ae.getBoundingClientRect() : null
  rigEls.forEach((s, el) => {
    if (!s.rect || s.rectAge++ > 20) {
      s.rect = el.getBoundingClientRect()
      s.rectAge = 0
    }
    const r = s.rect
    if (!r.width || r.bottom < 0 || r.top > window.innerHeight) return
    const d = el.dataset
    const bx = Number(d.bx || 0), by = Number(d.by || 0), bz = Number(d.bz || 0)
    let tx: number, ty: number
    if (field && field.width) {
      const span = Math.max(320, r.width * 3)
      tx = Math.tanh((field.left + field.width / 2 - (r.left + r.width / 2)) / span) * 0.8
      ty = Math.tanh((field.top + field.height / 2 - (r.top + r.height * 0.4)) / span) * 0.6
    } else if (idle) {
      tx = 0.45 * Math.sin(sec * 0.45 + s.phase) + 0.15 * Math.sin(sec * 1.13 + s.phase * 2)
      ty = 0.25 * Math.sin(sec * 0.6 + s.phase) - 0.05
    } else {
      // Soft saturation so a far-away cursor never pins her in an extreme pose.
      const span = Math.max(320, r.width * 3)
      tx = Math.tanh((pointer.x - (r.left + r.width / 2)) / span) * 0.8
      ty = Math.tanh((pointer.y - (r.top + r.height * 0.4)) / span) * 0.6
    }
    tx = clamp(tx + bx, -1, 1)
    ty = clamp(ty + by + s.lip * 0.1, -1, 1)
    const k = 1 - Math.exp(-dt * 4)
    const pax = s.ax
    s.ax += (tx - s.ax) * k
    s.ay += (ty - s.ay) * k
    s.az += (s.ax * 2.5 + bz + 0.8 * Math.sin(sec * 0.8 + s.phase) - s.az) * k
    // Spring hair: pushed opposite to head velocity, plus a soft breeze.
    const vel = (s.ax - pax) / dt
    s.hairV += (-90 * s.hair - 7 * s.hairV - vel * 60 + Math.sin(sec * 1.7 + s.phase) * 18) * dt
    s.hair = clamp(s.hair + s.hairV * dt, -16, 16)
    // Blink: random 2–6s intervals, occasional double blink.
    let eye = 1
    if (t >= s.blinkAt) {
      if (!s.blinkStart) s.blinkStart = t
      const p = (t - s.blinkStart) / 150
      if (p >= 1) {
        s.blinkStart = 0
        if (s.blinkTwice) {
          s.blinkTwice = false
          s.blinkAt = t + 120
        } else {
          s.blinkAt = t + 2000 + Math.random() * 4000
          s.blinkTwice = Math.random() < 0.2
        }
      } else eye = 1 - Math.sin(Math.PI * p) * 0.95
    }
    // Expressions ease toward the current mood; idle gets an occasional spontaneous smile.
    let mood = (d.mood as Mood) in MOODS ? (d.mood as Mood) : 'idle'
    if (mood === 'idle') {
      if (t > s.grinAt) {
        s.grinUntil = t + 1400 + Math.random() * 900
        s.grinAt = s.grinUntil + 7000 + Math.random() * 9000
      }
      if (t < s.grinUntil) mood = 'happy'
    }
    const target = MOODS[mood]
    const ke = 1 - Math.exp(-dt * 6)
    const ex = s.ex
    for (const key of Object.keys(ex) as (keyof Expr)[]) ex[key] += (target[key] - ex[key]) * ke
    eye = Math.min(eye, ex.lid)
    // Lip sync while responding.
    // A voiced clip publishes its real loudness on an ancestor (data-lip); otherwise lip-sync is procedural.
    const src = d.talk === '1' ? el.parentElement?.closest<HTMLElement>('[data-lip]') : null
    if (src?.dataset.lip !== undefined) {
      s.lipT = Number(src.dataset.lip)
      s.formT = Number(src.dataset.form ?? 0.5)
    } else if (d.talk === '1') {
      // Procedural speech: syllables of varying length and shape, with short pauses between words.
      if (t >= s.lipAt) {
        const pause = Math.random() < 0.18
        s.lipT = pause ? 0 : 0.3 + Math.random() * 0.7
        s.formT = Math.random()
        s.lipAt = t + (pause ? 140 + Math.random() * 120 : 90 + Math.random() * 110)
      }
    } else s.lipT = 0
    // Fast attack, slower release reads like a real jaw rather than a flapping mask.
    s.lip += (s.lipT - s.lip) * (1 - Math.exp(-dt * (s.lipT > s.lip ? 30 : 12)))
    s.form += (s.formT - s.form) * (1 - Math.exp(-dt * 10))
    const br = (Math.sin(sec * 1.75 + s.phase) + 1) / 2
    rigDraw.get(el)?.({ ax: s.ax, ay: s.ay, az: s.az, hair: s.hair, eye, lip: s.lip, form: s.form, br, t: sec % 1000, ...ex })
    const st = el.style
    st.setProperty('--ax', s.ax.toFixed(3))
    st.setProperty('--ay', s.ay.toFixed(3))
    st.setProperty('--az', s.az.toFixed(2))
    st.setProperty('--hair', s.hair.toFixed(2))
    st.setProperty('--eye', eye.toFixed(3))
    st.setProperty('--lip', s.lip.toFixed(3))
    st.setProperty('--br', br.toFixed(3))
    st.setProperty('--happy', ex.smile.toFixed(3))
    st.setProperty('--sad', clamp(-ex.mouth, 0, 1).toFixed(3))
  })
  rigRaf = rigEls.size ? requestAnimationFrame(rigFrame) : 0
}
const onPointer = (e: PointerEvent) => {
  pointer.x = e.clientX
  pointer.y = e.clientY
  pointer.at = performance.now()
}
const onLayout = () => rigEls.forEach((s) => (s.rect = null))
function useRig(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!rigEls.size) {
      window.addEventListener('pointermove', onPointer, { passive: true })
      window.addEventListener('pointerdown', onPointer, { passive: true })
      window.addEventListener('resize', onLayout)
      window.addEventListener('scroll', onLayout, { passive: true, capture: true })
    }
    rigEls.set(el, { ax: 0, ay: 0, az: 0, hair: 0, hairV: 0, lip: 0, lipT: 0, lipAt: 0, form: 0.5, formT: 0.5, blinkAt: performance.now() + 800 + Math.random() * 2500, blinkStart: 0, blinkTwice: false, phase: Math.random() * 6.28, rect: null, rectAge: 0, ex: { ...MOODS.idle }, grinAt: performance.now() + 5000 + Math.random() * 6000, grinUntil: 0 })
    if (!rigRaf) {
      rigLast = 0
      rigRaf = requestAnimationFrame(rigFrame)
    }
    return () => {
      rigEls.delete(el)
      if (!rigEls.size) {
        cancelAnimationFrame(rigRaf)
        rigRaf = 0
        window.removeEventListener('pointermove', onPointer)
        window.removeEventListener('pointerdown', onPointer)
        window.removeEventListener('resize', onLayout)
        window.removeEventListener('scroll', onLayout, { capture: true })
      }
    }
  }, [ref])
}
// ---- Live2D-style mesh renderer ---------------------------------------------------
// The illustration is drawn on a fine triangle grid; the vertex shader warps regions of it
// (head turn with a convex face, iris gaze, eyelid blink, jaw, breathing, hair and ahoge
// sway, head roll) the way Live2D warp deformers do. Landmarks are in texture pixels.
// Landmarks of each illustration, in texture pixels; `k` scales feature-sized constants
// (the full-body art's face is ~0.4× the bust's). Re-measure these if the art changes.
type Rig2D = {
  size: [number, number]; k: number; sway: number; cx: number
  eyeL: number[]; eyeR: number[]; eyeHalfW: number; lashTop: number; lowerLid: number
  irisL: number[]; irisR: number[]; mouth: number[]; mouthHalfW: number; cheekL: number[]; cheekR: number[]
  face: number[]; faceR: number[]; head: number[]; headR: number[]; neck: number[]; shoulderY: number; ahoge: number[]
  hairX: [number, number]; hairY: [number, number, number]
}
const LM: Rig2D & { crop: { x: number; y: number; size: number } } = {
  size: [768, 960], k: 1, sway: 1, cx: 384,
  eyeL: [281, 401], eyeR: [485, 401], eyeHalfW: 56, lashTop: -32, lowerLid: 30,
  irisL: [300, 406], irisR: [463, 405],
  mouth: [386, 512], mouthHalfW: 31,
  cheekL: [300, 468], cheekR: [470, 468],
  face: [385, 450], faceR: [150, 172],
  head: [384, 360], headR: [262, 295],
  neck: [384, 610], shoulderY: 650,
  ahoge: [320, 45],
  hairX: [150, 270], hairY: [360, 900, 99999],
  crop: { x: 385, y: 445, size: 330 },
}
const LM_BODY: Rig2D = {
  size: [600, 1536], k: 0.4, sway: 0.75, cx: 302,
  eyeL: [260, 207], eyeR: [344, 207], eyeHalfW: 22, lashTop: -15, lowerLid: 14,
  irisL: [266, 209], irisR: [340, 206],
  mouth: [304, 255], mouthHalfW: 12.5,
  cheekL: [258, 232], cheekR: [346, 232],
  face: [302, 224], faceR: [60, 70],
  head: [302, 165], headR: [105, 120],
  neck: [302, 300], shoulderY: 340,
  ahoge: [287, 28],
  hairX: [140, 190], hairY: [280, 760, 830],
}
const f1 = (n: number) => n.toFixed(2)
const v2 = ([x, y]: number[]) => `vec2(${f1(x)}, ${f1(y)})`
const shaderCache = new Map<Rig2D, { vs: string; fs: string }>()
const buildL2D = (L: Rig2D) => {
  const hit = shaderCache.get(L)
  if (hit) return hit
  const K = (n: number) => f1(n * L.k)
  const vs = `
attribute vec2 a_uv;
uniform vec2 u_size;
uniform float u_ax, u_ay, u_az, u_eye, u_br, u_hair, u_smile, u_wide, u_mouth, u_t;
// Shared with the fragment shader; precisions must match.
uniform mediump float u_lip;
uniform mediump float u_o;
varying vec2 v_uv;
varying vec2 v_p;
const float EW = ${f1(L.eyeHalfW)};
const float YT = ${f1(L.lashTop)};
const float YL = ${f1(L.lowerLid)};
float ell(vec2 p, vec2 c, vec2 r) { return length((p - c) / r); }
// Blink: upper lashes and lower lid meet near the bottom of the eye, so the bangs above barely move.
float blink(vec2 p, vec2 e, float c) {
  float wx = 1.0 - smoothstep(0.78, 1.05, abs(p.x - e.x) / EW);
  float yt = e.y + YT;
  float yl = e.y + YL;
  float ym = e.y + YL * 0.45;
  float k = c * 0.94;
  float dy;
  if (p.y >= yt && p.y <= yl) dy = (ym - p.y) * k;
  else if (p.y < yt) dy = (ym - yt) * k * smoothstep(yt - ${K(18)}, yt, p.y);
  else dy = (ym - yl) * k * (1.0 - smoothstep(yl, yl + ${K(16)}, p.y));
  return dy * wx;
}
// Eye-smile: the lower lid and cheek push up into a "^" shape.
float squint(vec2 p, vec2 e, float s) {
  float wx = 1.0 - smoothstep(0.7, 1.05, abs(p.x - e.x) / EW);
  float yt = e.y + YT + ${K(8)};
  float yl = e.y + YL;
  float dy = 0.0;
  if (p.y > yt) {
    if (p.y <= yl) dy = -(p.y - yt) * s * 0.6;
    else dy = -(yl - yt) * s * 0.6 * (1.0 - smoothstep(yl, yl + ${K(48)}, p.y));
  }
  float arch = 1.0 - pow(abs(p.x - e.x) / EW, 2.0);
  return dy * wx * (0.75 + 0.25 * arch);
}
float widen(vec2 p, vec2 e, float w) {
  float k = 1.0 - smoothstep(0.5, 1.0, ell(p, e, vec2(EW, ${K(50)})));
  return (p.y - e.y) * w * 0.16 * k;
}
void main() {
  vec2 p = a_uv * u_size;
  v_uv = a_uv;
  v_p = p;
  vec2 o = vec2(0.0);
  float c = 1.0 - u_eye;
  vec2 eL = ${v2(L.eyeL)}, eR = ${v2(L.eyeR)};
  o.y += widen(p, eL, u_wide) + widen(p, eR, u_wide);
  o.y += squint(p, eL, u_smile) + squint(p, eR, u_smile);
  o.y += blink(p, eL, c) + blink(p, eR, c);
  // Mouth corners: curve up for a smile, down for a frown.
  vec2 dm = p - ${v2(L.mouth)};
  float mhw = ${f1(L.mouthHalfW)};
  float mw = 1.0 - smoothstep(0.55, 1.0, length(dm / vec2(mhw * 1.45, ${K(20)})));
  float mx = clamp(abs(dm.x) / mhw, 0.0, 1.0);
  float mk = u_mouth > 0.0 ? ${K(5)} : ${K(10)};
  o.y += -u_mouth * mk * pow(mx, 1.6) * mw;
  o.y += min(u_mouth, 0.0) * ${K(2.5)} * (1.0 - clamp(abs(dm.x) / (mhw * 0.75), 0.0, 1.0)) * mw;
  o.x += u_mouth * ${K(1.5)} * sign(dm.x) * mw * mx;
  // Iris gaze: eyes lead the head.
  float gz = max(1.0 - smoothstep(0.45, 1.0, ell(p, ${v2(L.irisL)}, vec2(${K(44)}, ${K(38)}))),
                 1.0 - smoothstep(0.45, 1.0, ell(p, ${v2(L.irisR)}, vec2(${K(44)}, ${K(38)}))));
  o += vec2(u_ax * ${K(8)}, u_ay * ${K(5.5)}) * gz;
  float jaw = (1.0 - smoothstep(0.6, 1.0, ell(p, ${v2([L.mouth[0], L.mouth[1] + 36 * L.k])}, vec2(${K(85)}, ${K(48)})))) * smoothstep(${f1(L.mouth[1] - 2 * L.k)}, ${f1(L.mouth[1] + 8 * L.k)}, p.y);
  o.y += max(u_lip, u_o * 0.6) * ${K(6)} * jaw;
  // Head turn: whole head plus a convex face so the centre moves more than the outline.
  float wH = 1.0 - smoothstep(0.55, 1.1, ell(p, ${v2(L.head)}, ${v2(L.headR)}));
  vec2 q = (p - ${v2(L.face)}) / ${v2(L.faceR)};
  float bulge = clamp(1.0 - dot(q, q), 0.0, 1.0);
  o += vec2(u_ax * ${K(10)}, u_ay * ${K(7)}) * wH + vec2(u_ax * ${K(10)}, u_ay * ${K(6)}) * bulge;
  // Breathing: shoulders and chest rise, head follows slightly.
  float sh = smoothstep(${f1(L.shoulderY - 70 * L.k)}, ${f1(L.shoulderY + 40 * L.k)}, p.y) * (1.0 - smoothstep(${f1(L.shoulderY + 80 * L.k)}, ${f1(L.shoulderY + 330 * L.k)}, p.y));
  o.y += -u_br * ${K(5)} * sh - u_br * ${K(3)} * wH;
  o.x += u_ax * ${K(3)} * sh;
  // Hair: spring sway plus a soft wave travelling down the long strands.
  float hw = smoothstep(${f1(L.hairX[0])}, ${f1(L.hairX[1])}, abs(p.x - ${f1(L.cx)})) * smoothstep(${f1(L.hairY[0])}, ${f1(L.hairY[1])}, p.y) * (1.0 - smoothstep(${f1(L.hairY[1])}, ${f1(L.hairY[2])}, p.y));
  o.x += (u_hair * 0.9 + sin(p.y * ${f1(0.016 / L.k)} - u_t * 1.7 + sign(p.x - ${f1(L.cx)}) * 1.3) * 2.6) * ${f1(L.sway)} * hw;
  float ah = (1.0 - smoothstep(0.0, ${K(85)}, length(p - ${v2(L.ahoge)}))) * (1.0 - smoothstep(${f1(L.ahoge[1] - 20 * L.k)}, ${f1(L.ahoge[1] + 45 * L.k)}, p.y));
  o.x += (u_hair * 2.2 + sin(u_t * 2.3) * 2.0) * ${K(1)} * ah;
  vec2 pp = p + o;
  float a = radians(u_az * 0.8) * wH;
  vec2 d = pp - ${v2(L.neck)};
  pp = ${v2(L.neck)} + vec2(d.x * cos(a) - d.y * sin(a), d.x * sin(a) + d.y * cos(a));
  vec2 clip = pp / u_size * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`
  const fs = `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_lip;
uniform float u_o;
uniform float u_blush;
uniform float u_form;
varying vec2 v_uv;
varying vec2 v_p;
void main() {
  vec4 c = texture2D(u_tex, v_uv);
  vec2 br = vec2(${K(48)}, ${K(22)});
  float bl = (1.0 - smoothstep(0.2, 1.0, length((v_p - ${v2(L.cheekL)}) / br)))
           + (1.0 - smoothstep(0.2, 1.0, length((v_p - ${v2(L.cheekR)}) / br)));
  c.rgb = mix(c.rgb, vec3(0.98, 0.45, 0.55) * c.a, clamp(bl, 0.0, 1.0) * u_blush * 0.42 * c.a);
  // Anime-style open mouth hanging from the painted lip line: dark interior, upper teeth,
  // tongue, darker rim and a soft lower-lip sheen. u_form: 0 = round "o/u", 1 = wide "e/i".
  float open = max(u_lip, u_o * 0.55);
  if (open > 0.03) {
    vec2 dm = v_p - ${v2(L.mouth)};
    float hw = ${f1(L.mouthHalfW)} * mix(0.5, 0.95, u_form) * (0.7 + 0.3 * open);
    float u = dm.x / hw;
    float au = abs(u);
    float top = ${K(0.6)} - ${K(2.2)} * mix(0.45, 1.0, u_form) * u * u;
    float H = (${K(2)} + ${K(12)} * open) * mix(1.2, 0.72, u_form);
    float bot = top + H * pow(max(1.0 - u * u, 0.0), mix(0.5, 0.75, u_form));
    float soft = ${K(1.1)};
    float inX = 1.0 - smoothstep(1.0 - soft / hw, 1.0, au);
    float inY = smoothstep(top - soft * 0.5, top + soft * 0.5, dm.y) * (1.0 - smoothstep(bot - soft, bot, dm.y));
    float m = inX * inY * c.a;
    float ty = clamp((dm.y - top) / max(bot - top, 0.001), 0.0, 1.0);
    // Interior: darkest in the middle (depth), slightly lighter toward the lips.
    float depth = 1.0 - abs(ty - 0.45) * 1.6;
    vec3 col = mix(vec3(0.42, 0.12, 0.16), vec3(0.22, 0.05, 0.08), clamp(depth, 0.0, 1.0));
    float edge = min(min(dm.y - top, bot - dm.y), (1.0 - au) * hw);
    col *= mix(0.72, 1.0, smoothstep(0.0, ${K(1.6)}, edge));
    float tg = 1.0 - smoothstep(0.5, 1.0, length(vec2(u * 1.7, (dm.y - (bot - H * 0.16)) / (H * 0.3 + 0.001))));
    col = mix(col, vec3(0.76, 0.34, 0.40), tg * smoothstep(0.25, 0.5, open) * 0.9);
    float tb = ${K(1)} + ${K(2)} * open;
    float teeth = smoothstep(0.26, 0.42, open) * mix(0.55, 1.0, u_form) * (1.0 - smoothstep(0.6, 0.8, au)) * (1.0 - smoothstep(tb, tb + soft, dm.y - top));
    col = mix(col, vec3(0.97, 0.95, 0.94), teeth);
    c.rgb = mix(c.rgb, col * c.a, m);
    float sheen = (1.0 - smoothstep(0.0, ${K(2.4)}, abs(dm.y - bot - ${K(2.2)}))) * (1.0 - smoothstep(0.45, 0.85, au)) * smoothstep(0.15, 0.45, open);
    c.rgb = mix(c.rgb, vec3(0.97, 0.68, 0.70) * c.a, sheen * 0.3 * c.a);
  }
  gl_FragColor = c;
}`
  const out = { vs, fs }
  shaderCache.set(L, out)
  return out
}
const NEUTRAL: RigPose = { ax: 0, ay: 0, az: 0, hair: 0, eye: 1, lip: 0, form: 0.5, br: 0.5, t: 0, smile: 0.12, wide: 0, mouth: 0.35, o: 0, blush: 0.2, lid: 1 }

function L2DCanvas({ rootRef, width, height, art, rig }: { rootRef: React.RefObject<HTMLDivElement | null>; width: number; height: number; art: string; rig: Rig2D }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const host = hostRef.current
    const root = rootRef.current
    if (!host || !root) return
    // A fresh canvas per effect run: a canvas whose context was lost can never get a new one,
    // which breaks React StrictMode's mount → unmount → mount in development.
    const canvas = document.createElement('canvas')
    canvas.className = 'block h-full w-full'
    host.appendChild(canvas)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    const opts = { premultipliedAlpha: true, antialias: true, alpha: true }
    const gl2 = canvas.getContext('webgl2', opts)
    const gl = (gl2 ?? canvas.getContext('webgl', opts)) as WebGLRenderingContext | null
    if (!gl) {
      canvas.remove()
      setFailed(true)
      return
    }
    const sh = (type: number, src: string) => {
      const x = gl.createShader(type)!
      gl.shaderSource(x, src)
      gl.compileShader(x)
      return x
    }
    const prog = gl.createProgram()!
    const { vs, fs } = buildL2D(rig)
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('AOI avatar: WebGL shader failed, using static art.', gl.getProgramInfoLog(prog))
      canvas.remove()
      setFailed(true)
      return
    }
    gl.useProgram(prog)
    // Square cells, fine enough that each eye spans several rows (needed for a clean blink).
    const COLS = rig.k < 1 ? 120 : 72
    const ROWS = Math.round((COLS * rig.size[1]) / rig.size[0])
    const uv = new Float32Array((COLS + 1) * (ROWS + 1) * 2)
    for (let y = 0, i = 0; y <= ROWS; y++) for (let x = 0; x <= COLS; x++) { uv[i++] = x / COLS; uv[i++] = y / ROWS }
    const idx = new Uint16Array(COLS * ROWS * 6)
    for (let y = 0, i = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const v = y * (COLS + 1) + x
        idx.set([v, v + 1, v + COLS + 1, v + 1, v + COLS + 2, v + COLS + 1], i)
        i += 6
      }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a_uv')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)
    const U = (n: string) => gl.getUniformLocation(prog, n)
    const keys = ['ax', 'ay', 'az', 'eye', 'lip', 'form', 'br', 'hair', 'smile', 'wide', 'mouth', 'o', 'blush', 't'] as const
    const u = Object.fromEntries(keys.map((k) => [k, U(`u_${k}`)])) as Record<(typeof keys)[number], WebGLUniformLocation | null>
    gl.uniform2f(U('u_size'), rig.size[0], rig.size[1])
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.viewport(0, 0, canvas.width, canvas.height)
    let ready = false
    let last = NEUTRAL
    const draw = (p: RigPose) => {
      last = p
      if (!ready) return
      for (const k of keys) gl.uniform1f(u[k], p[k])
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0)
    }
    const img = new Image()
    img.onload = () => {
      const tex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      if (gl2) {
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      ready = true
      draw(last)
    }
    img.onerror = () => setFailed(true)
    img.src = art
    rigDraw.set(root, draw)
    return () => {
      rigDraw.delete(root)
      img.onload = null
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
    }
  }, [rootRef, width, height, art, rig])
  if (failed) return <img src={art} alt="" className="h-full w-full object-contain" draggable={false} />
  return <div ref={hostRef} className="h-full w-full" />
}

function Avatar({ state, width, variant = 'full', onPoke }: { state: AvatarState; width: number; variant?: 'full' | 'face' | 'body'; onPoke?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  useRig(rootRef)
  const err = state === 'error'
  const listening = state === 'listening'
  const processing = state === 'processing'
  const talking = state === 'responding'
  const face = variant === 'face'
  const body = variant === 'body'
  const height = face ? width : body ? Math.round((width * LM_BODY.size[1]) / LM_BODY.size[0]) : Math.round(width * 1.25)
  const spinner = Math.max(16, width * 0.13)
  // Per-state pose biases are fed into the rig so transitions stay springy.
  const [beam, setBeam] = useState(false)
  const beamTimer = useRef(0)
  useEffect(() => () => clearTimeout(beamTimer.current), [])
  const poke = () => {
    onPoke?.()
    setBeam(true)
    clearTimeout(beamTimer.current)
    beamTimer.current = window.setTimeout(() => setBeam(false), 1800)
  }
  const bias = processing ? { bx: 0.3, by: -0.55, bz: 3 } : listening ? { bx: -0.2, by: -0.05, bz: -4 } : err ? { bx: 0, by: 0.3, bz: 3 } : { bx: 0, by: 0, bz: 0 }
  const mood: Mood = err ? 'sad' : processing ? 'think' : talking ? 'talk' : listening ? 'listen' : beam ? 'happy' : 'idle'
  // Face crop: a 330px square around the face in texture pixels.
  const { size: crop, x: fx, y: fy } = LM.crop
  const k = width / crop

  return (
    <div
      ref={rootRef}
      data-bx={bias.bx}
      data-by={bias.by}
      data-bz={bias.bz}
      data-mood={mood}
      data-talk={talking ? '1' : '0'}
      onPointerDown={face ? undefined : poke}
      className={`relative shrink-0 ${face ? '' : 'cursor-pointer'}`}
      style={{ width, height }}
      role="img"
      aria-label={`AOI avatar: ${state}`}
    >
      {listening && (
        <span
          className="aoi-glow absolute rounded-full"
          style={
            face
              ? { left: '50%', top: '50%', width: width + 10, height: width + 10, boxShadow: '0 0 0 2px rgba(176,30,46,0.9), 0 0 14px 3px rgba(176,30,46,0.55)' }
              : {
                  left: '50%',
                  top: '36%',
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
      {face ? (
        <div className="h-full w-full overflow-hidden rounded-full" style={{ background: 'linear-gradient(160deg, #475569, #1E293B)' }}>
          <img
            src={aoiArt}
            alt=""
            draggable={false}
            className="pointer-events-none max-w-none select-none"
            style={{
              width: LM.size[0] * k,
              height: LM.size[1] * k,
              transform: `translate(${(crop / 2 - fx) * k}px, ${(crop / 2 - fy) * k}px) translate(calc(var(--ax, 0) * ${width * 0.04}px), calc(var(--ay, 0) * ${width * 0.03}px + var(--br, 0) * -${width * 0.01}px)) rotate(calc(var(--az, 0) * 0.6deg))`,
              transformOrigin: `${fx * k}px ${fy * k}px`,
            }}
          />
        </div>
      ) : (
        <L2DCanvas rootRef={rootRef} width={width} height={height} art={body ? aoiBodyArt : aoiArt} rig={body ? LM_BODY : LM} />
      )}
      {!face && !body && (
        // Anime "manpu" marks that ride along with the head turn.
        <svg
          aria-hidden
          viewBox="0 0 768 960"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          style={{ transform: `translate(calc(var(--ax, 0) * ${width * 0.025}px), calc(var(--ay, 0) * ${width * 0.018}px))` }}
        >
          <g className="transition-opacity duration-300" style={{ opacity: err ? 1 : 0 }}>
            <path className={err ? 'aoi-drip' : ''} d="M592 282c-16 26-20 40-20 50a20 20 0 0 0 40 0c0-10-4-24-20-50Z" fill="#BFE9FF" stroke="#4BA3D9" strokeWidth="5" />
            <path d="M584 328a8 8 0 0 0 8 8" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" />
          </g>
          <g style={{ opacity: 'var(--happy, 0)' }}>
            {[
              [190, 286, 1],
              [604, 236, 0.8],
              [648, 352, 0.55],
            ].map(([x, y, k], i) => (
              <path
                key={i}
                className="aoi-twinkle"
                style={{ animationDelay: `${i * 0.35}s`, transformOrigin: `${x}px ${y}px` }}
                d={`M${x} ${y - 30 * k}Q${x + 4 * k} ${y - 4 * k} ${x + 30 * k} ${y}Q${x + 4 * k} ${y + 4 * k} ${x} ${y + 30 * k}Q${x - 4 * k} ${y + 4 * k} ${x - 30 * k} ${y}Q${x - 4 * k} ${y - 4 * k} ${x} ${y - 30 * k}Z`}
                fill="#FFF7C2"
                stroke="#F6C445"
                strokeWidth="3"
              />
            ))}
          </g>
          <g className="transition-opacity duration-300" style={{ opacity: processing ? 1 : 0 }}>
            {[0, 1, 2].map((i) => (
              <circle key={i} className="aoi-dot" style={{ animationDelay: `${i * 0.18}s` }} cx={575 + i * 34} cy={290 - i * 14} r={9 + i * 2} fill="#fff" stroke="#94A3B8" strokeWidth="3" />
            ))}
          </g>
        </svg>
      )}
      {face && (
        <span
          aria-label="Online"
          className="absolute rounded-full bg-[#22C55E] shadow-[0_0_0_2px_#1E293B]"
          style={{ right: 0, bottom: 0, width: 11, height: 11 }}
        />
      )}
    </div>
  )
}

function SourceChip({ label, external, onOpen }: { label: string; external?: boolean; onOpen: (l: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(label)}
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

// Backend model contract: `id` is the exact string stored in settings.model and sent as `model`
// in POST /v1/chat/completions. The backend honors only these four ids; `name` is display-only.
const MODELS = [
  { id: 'aoi-general', name: 'AOI General', tag: 'Default', desc: 'Balanced answers for everyday questions' },
  { id: 'aoi-policy', name: 'AOI Policy', tag: 'Strict', desc: 'Citation-first answers from official documents' },
  { id: 'aoi-scholar', name: 'AOI STEM Deep', tag: 'Reasoning', desc: 'Step-by-step help on harder problems' },
  { id: 'aoi-scholarmini', name: 'AOI STEM Fast', tag: 'Quick', desc: 'Short, fast answers for STEM questions' },
] as const
type ModelId = (typeof MODELS)[number]['id']

type Chat = { id: number; title: string; msgs: Msg[]; updated: number; pinned?: boolean; renamed?: boolean }

const DAY = 86_400_000
// No pre-made conversations: history starts empty and fills with real model replies.
const SEED_CHATS = (): Chat[] => []
// Ids of the old scripted sample replies, so previously saved copies are dropped on load.
const LEGACY_SEED_CIDS = new Set(['aoi-7x9f2', 'aoi-m3k8q'])

const load = <T,>(key: string, fallback: () => T): T => {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback()
  } catch {
    return fallback()
  }
}

// localStorage is user-editable; validate shapes before trusting persisted data.
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const str = (x: unknown, max = 20000) => (typeof x === 'string' ? x.slice(0, max) : '')
const strList = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string').slice(0, 20).map((s) => s.slice(0, 200)) : undefined)
const cleanMsg = (m: unknown): Msg | null => {
  if (!isObj(m) || typeof m.id !== 'number' || (m.role !== 'user' && m.role !== 'aoi')) return null
  return {
    id: m.id, role: m.role, text: str(m.text), time: str(m.time, 20),
    files: strList(m.files), sources: strList(m.sources),
    rating: m.rating === 'up' || m.rating === 'down' ? m.rating : undefined,
    external: m.external === true || undefined,
    cid: typeof m.cid === 'string' ? m.cid.slice(0, 32) : undefined,
    error: m.error === 'config' || m.error === 'network' || m.error === 'server' ? m.error : undefined,
  }
}
const cleanChats = (x: unknown): Chat[] | null => {
  if (!Array.isArray(x)) return null
  return x.slice(0, 200).flatMap((c) => {
    if (!isObj(c) || typeof c.id !== 'number' || !Array.isArray(c.msgs)) return []
    if (c.msgs.some((m) => isObj(m) && typeof m.cid === 'string' && LEGACY_SEED_CIDS.has(m.cid))) return []
    const msgs = c.msgs.map(cleanMsg).filter((m): m is Msg => m !== null)
    return [{ id: c.id, title: str(c.title, 120) || 'Chat', msgs, updated: typeof c.updated === 'number' ? c.updated : Date.now(), pinned: c.pinned === true, renamed: c.renamed === true }]
  })
}
const ROLE_SET = ['Student', 'Faculty', 'Staff', 'Admin'] as const
const cleanAudit = (x: unknown): AuditRow[] | null => {
  if (!Array.isArray(x)) return null
  return x.slice(0, 300).flatMap((r) =>
    isObj(r) && typeof r.cid === 'string' && typeof r.ts === 'number' && ROLE_SET.includes(r.role as Role)
      ? [{ cid: r.cid.slice(0, 32), ts: r.ts, role: r.role as Role, intent: str(r.intent, 40), model: str(r.model, 60), path: str(r.path, 200), external: r.external === true, wait: typeof r.wait === 'number' && r.wait > 0 ? Math.min(r.wait, 600_000) : undefined, user: typeof r.user === 'string' ? r.user.slice(0, 254) : undefined }]
      : [],
  )
}
const cleanUser = (x: unknown): User | null =>
  isObj(x) && typeof x.email === 'string' && typeof x.id === 'string' ? userFrom(x.email.slice(0, 254), x.id.slice(0, 20)) : null
// Only accept the JPEG data URLs this app writes itself; anything else could inject CSS into url(...).
const SAFE_BG = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/
const MAX_ATTACH_BYTES = 10 * 1024 * 1024
const MAX_BG_BYTES = 15 * 1024 * 1024
const MAX_MSG_CHARS = 4000

// ---- Model connection -------------------------------------------------------------
// Any OpenAI-compatible chat endpoint works: Ollama (http://localhost:11434/v1), LM Studio
// (http://localhost:1234/v1), vLLM, llama.cpp server, or a cloud provider behind a proxy.
// "local" serves general, policy and homework routes on the campus GPU; "external" serves the
// research route (after the consent gate) and falls back to local when left empty.
type LlmEndpoint = { baseUrl: string; model: string; apiKey: string }
type LlmConfig = { local: LlmEndpoint; external: LlmEndpoint }
const ENV = import.meta.env
const DEFAULT_LLM: LlmConfig = {
  local: { baseUrl: String(ENV.VITE_AOI_LLM_URL ?? 'http://localhost:11434/v1'), model: String(ENV.VITE_AOI_LLM_MODEL ?? ''), apiKey: '' },
  external: { baseUrl: String(ENV.VITE_AOI_EXTERNAL_URL ?? ''), model: String(ENV.VITE_AOI_EXTERNAL_MODEL ?? ''), apiKey: '' },
}
const cleanEndpoint = (x: unknown, d: LlmEndpoint): LlmEndpoint => {
  const o = isObj(x) ? x : {}
  const url = str(o.baseUrl, 300).trim()
  return {
    baseUrl: url === '' || /^https?:\/\/[^\s]+$/i.test(url) ? url : d.baseUrl,
    model: str(o.model, 120).trim(),
    apiKey: str(o.apiKey, 400).trim(),
  }
}
const cleanLlm = (x: unknown): LlmConfig => {
  const o = isObj(x) ? x : {}
  const cfg = { local: isObj(o.local) ? cleanEndpoint(o.local, DEFAULT_LLM.local) : DEFAULT_LLM.local, external: isObj(o.external) ? cleanEndpoint(o.external, DEFAULT_LLM.external) : DEFAULT_LLM.external }
  // A set VITE_* URL wins over a saved one, so editing .env.local takes effect on the next load
  // (the llm effect writes the result back to localStorage).
  const lu = String(ENV.VITE_AOI_LLM_URL ?? '').trim(), eu = String(ENV.VITE_AOI_EXTERNAL_URL ?? '').trim()
  if (lu && cfg.local.baseUrl !== lu) cfg.local = { ...cfg.local, baseUrl: lu }
  if (eu && cfg.external.baseUrl !== eu) cfg.external = { ...cfg.external, baseUrl: eu }
  return cfg
}
const usable = (e: LlmEndpoint) => !!e.baseUrl && !!e.model
const endpointFor = (cfg: LlmConfig, route: Route) => (route === 'research' && usable(cfg.external) ? cfg.external : cfg.local)

const SYSTEM_BASE =
  'You are AOI (Academic Operations Intelligence), the campus AI assistant of Mindanao State University – Zamboanga Sibugay (MSU-ZS). ' +
  'Be accurate, warm and concise. Format with Markdown: short paragraphs, bullet or numbered lists, tables when comparing, and fenced code blocks for code. ' +
  'If you are not sure, say so plainly and suggest which university office can confirm. Never invent policies, memo numbers, page numbers, dates or citations.'
const ROUTE_PROMPTS: Record<Route, string> = {
  general: 'Help with everyday campus life and learning questions.',
  policy: 'The user is asking about university policy or procedures. Only state what official MSU-ZS policy supports, and say which office (e.g. the Registrar) or document to check for confirmation.',
  research: 'Help with academic research: synthesize what is known, compare viewpoints, and suggest search terms and reputable sources to verify. The query has been anonymized; do not ask for personal details.',
  homework:
    'The user is asking you to complete graded work. Do not write the essay, solve the assignment or give final answers to graded tasks. ' +
    'Instead, explain the underlying concepts, outline an approach, ask a guiding question, and offer to review their own attempt. Be encouraging, not preachy.',
}
const MODE_PROMPTS: Record<ModelId, string> = {
  'aoi-general': '',
  'aoi-policy': 'Prioritise official documents and always name the office to confirm with.',
  'aoi-scholar': 'Work step by step and show your reasoning clearly.',
  'aoi-scholarmini': 'Be brief: 1–4 sentences unless the user asks for more.',
}
const HISTORY_TURNS = 12

class LlmError extends Error {
  constructor(public kind: 'config' | 'network' | 'server', message: string) {
    super(message)
  }
}
const apiUrl = (e: LlmEndpoint, path: string) => `${e.baseUrl.replace(/\/+$/, '')}${path}`
const headersFor = (e: LlmEndpoint) => ({ 'Content-Type': 'application/json', ...(e.apiKey ? { Authorization: `Bearer ${e.apiKey}` } : {}) })

// Streams an OpenAI-compatible chat completion, calling onDelta for each text chunk.
async function streamChat(e: LlmEndpoint, messages: { role: 'system' | 'user' | 'assistant'; content: string }[], signal: AbortSignal, onDelta: (t: string) => void) {
  if (!usable(e)) throw new LlmError('config', 'No model is connected yet.')
  let res: Response
  try {
    res = await fetch(apiUrl(e, '/chat/completions'), { method: 'POST', headers: headersFor(e), body: JSON.stringify({ model: e.model, messages, stream: true, temperature: 0.4 }), signal })
  } catch (err) {
    if (signal.aborted) throw err
    throw new LlmError('network', `Couldn't reach the model server at ${e.baseUrl}.`)
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 200)
    throw new LlmError('server', `The model server answered ${res.status}${body ? `: ${body}` : '.'}`)
  }
  if (!res.body || !(res.headers.get('content-type') ?? '').includes('event-stream')) {
    const json = await res.json().catch(() => null)
    const text = json?.choices?.[0]?.message?.content
    if (typeof text !== 'string') throw new LlmError('server', 'The model server sent an unexpected response.')
    onDelta(text)
    return
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  // Returns true on the [DONE] terminator.
  const handle = (line: string) => {
    const l = line.trim()
    if (!l.startsWith('data:')) return false
    const data = l.slice(5).trim()
    if (data === '[DONE]') return true
    try {
      const delta = JSON.parse(data)?.choices?.[0]?.delta?.content
      if (typeof delta === 'string' && delta) onDelta(delta)
    } catch {}
    return false
  }
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>
    try {
      chunk = await reader.read()
    } catch (err) {
      if (signal.aborted) throw err
      throw new LlmError('network', 'The connection to the model server dropped mid-reply.')
    }
    if (chunk.done) break
    buf += dec.decode(chunk.value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) if (handle(line)) return
  }
  // Stream closed without [DONE]: keep what arrived, including a final unterminated line.
  buf += dec.decode()
  for (const line of buf.split('\n')) if (handle(line)) return
}
async function listModels(e: LlmEndpoint): Promise<string[]> {
  if (!e.baseUrl) throw new LlmError('config', 'Add a server URL first.')
  let res: Response
  try {
    res = await fetch(apiUrl(e, '/models'), { headers: headersFor(e) })
  } catch {
    throw new LlmError('network', `Couldn't reach ${e.baseUrl}. Is the server running and allowing this site (CORS)?`)
  }
  if (!res.ok) throw new LlmError('server', `Server answered ${res.status}.`)
  const json = await res.json().catch(() => null)
  const ids = Array.isArray(json?.data) ? json.data.map((m: { id?: unknown }) => m?.id).filter((x: unknown): x is string => typeof x === 'string') : []
  return ids.slice(0, 50)
}

// Single local GPU (RTX 4050, 6 GB): one generation at a time, strict first come, first served.
type Job = { id: number; mine: boolean; role: Role; dept: string; arrived: number; start: number; end: number }
const GPU_JOB_MS = 2100 // matches AOI's processing (1500ms) + responding (600ms) phases
// Recompute start/end for jobs that have not started yet (used when someone leaves the line).
const reschedule = (list: Job[], now: number) => {
  let prevEnd = 0
  return list.map((j) => {
    if (j.start <= now) {
      prevEnd = j.end
      return j
    }
    const start = Math.max(j.arrived, prevEnd, now)
    prevEnd = start + (j.end - j.start)
    return { ...j, start, end: prevEnd }
  })
}
const secs = (ms: number) => `${Math.max(1, Math.ceil(ms / 1000))}s`

const FONT_SIZES = { sm: 13, md: 14, lg: 16 } as const
const TEXT_ZOOM = { sm: 0.92, md: 1, lg: 1.14 } as const
type Theme = 'system' | 'light' | 'dark'
type Settings = { theme: Theme; fontSize: keyof typeof FONT_SIZES; showTime: boolean; bgId: string; bgDim: number; model: ModelId; sidebarCollapsed: boolean }
const DEFAULT_SETTINGS: Settings = { theme: 'system', fontSize: 'md', showTime: true, bgId: 'default', bgDim: 35, model: 'aoi-general', sidebarCollapsed: false }
const cleanSettings = (x: unknown): Settings => {
  const s = isObj(x) ? x : {}
  const d = DEFAULT_SETTINGS
  return {
    theme: s.theme === 'light' || s.theme === 'dark' || s.theme === 'system' ? s.theme : d.theme,
    fontSize: s.fontSize === 'sm' || s.fontSize === 'md' || s.fontSize === 'lg' ? s.fontSize : d.fontSize,
    showTime: typeof s.showTime === 'boolean' ? s.showTime : d.showTime,
    bgId: typeof s.bgId === 'string' && (s.bgId === 'custom' || BACKGROUNDS.some((b) => b.id === s.bgId)) ? s.bgId : d.bgId,
    bgDim: typeof s.bgDim === 'number' && Number.isFinite(s.bgDim) ? Math.min(80, Math.max(0, s.bgDim)) : d.bgDim,
    // Accept only canonical ids; migrate labels saved by older builds (e.g. 'AOI General' → 'aoi-general').
    model: MODELS.find((m) => m.id === s.model || m.name === s.model)?.id ?? d.model,
    sidebarCollapsed: typeof s.sidebarCollapsed === 'boolean' ? s.sidebarCollapsed : d.sidebarCollapsed,
  }
}

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
  { tag: 'Research', title: 'Turn a topic into research questions', hint: 'Narrow a broad idea into testable questions', prompt: 'Help me turn the topic "social media use among senior high school students" into three focused, testable research questions' },
  { tag: 'Research', title: 'Spot a weak methodology', hint: 'Sampling, bias and validity checks', prompt: 'What are the most common methodology flaws in student research papers, and how do I check my own for sampling bias and validity?' },
  { tag: 'Policy', title: 'Grading system and honors', hint: 'GWA, Dean’s List and retention rules', prompt: 'How does the grading system work, and what GWA is needed for the Dean’s List and to keep my scholarship?' },
  { tag: 'Policy', title: 'Requesting academic records', hint: 'TOR, certifications and processing time', prompt: 'How do I request my transcript of records and other certifications from the registrar?' },
  { tag: 'Study', title: 'Make flashcards from my notes', hint: 'Active recall with a clear format', prompt: 'Show me how to turn lecture notes into effective flashcards for active recall' },
  { tag: 'Study', title: 'Summarize a journal article fast', hint: 'Read smarter in 15 minutes', prompt: 'Give me a step-by-step method to read and summarize a journal article in 15 minutes' },
  { tag: 'Campus', title: 'Balance school and part-time work', hint: 'A realistic weekly schedule', prompt: 'Help me plan a weekly schedule that balances classes, study time and a part-time job' },
  { tag: 'Campus', title: 'Present research confidently', hint: 'Slides, pacing and handling questions', prompt: 'What are good practices for presenting research in a 10-minute class report, including slides and Q&A?' },
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

// ---- Markdown (safe subset) for model replies ----------------------------------------
// Everything renders as React text nodes, so model output can never inject HTML.
// Links are limited to http(s) and open in a new tab.
const INLINE_RE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\[[^\]\n]+\]\((?:https?:\/\/[^\s)]+)\)|(?<![\w*])\*[^*\s][^*\n]*\*(?![\w*])|(?<!\w)_[^_\s][^_\n]*_(?!\w)|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g
function inline(t: string): React.ReactNode[] {
  return t.split(INLINE_RE).map((p, i) => {
    if (!p) return null
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) return <code key={i} className="rounded bg-t-tint/10 px-1 py-0.5 font-mono text-[0.88em]">{p.slice(1, -1)}</code>
    if ((p.startsWith('**') && p.endsWith('**') && p.length > 4) || (p.startsWith('__') && p.endsWith('__') && p.length > 4)) return <strong key={i} className="font-semibold">{inline(p.slice(2, -2))}</strong>
    const link = p.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-t-accent underline decoration-[#800000]/50 underline-offset-2 hover:decoration-current">{link[1]}</a>
    if (/^https?:\/\//.test(p)) return <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-t-accent underline decoration-[#800000]/50 underline-offset-2 hover:decoration-current">{p}</a>
    if ((p.startsWith('*') && p.endsWith('*') && p.length > 2) || (p.startsWith('_') && p.endsWith('_') && p.length > 2)) return <em key={i}>{p.slice(1, -1)}</em>
    return p
  })
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-t-line bg-[#0d0f14] text-[#e5e7eb]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/50">{lang || 'code'}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(code).catch(() => {})
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1400)
          }}
          className="rounded-md px-2 py-0.5 text-[11.5px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="no-scrollbar overflow-x-auto px-3.5 py-3 font-mono text-[0.85em] leading-relaxed"><code>{code}</code></pre>
    </div>
  )
}

type MdBlock =
  | { k: 'p'; lines: string[] }
  | { k: 'h'; level: number; text: string }
  | { k: 'ul' | 'ol'; items: { text: string; depth: number; n?: number }[] }
  | { k: 'quote'; lines: string[] }
  | { k: 'code'; lang: string; code: string }
  | { k: 'hr' }
  | { k: 'table'; head: string[]; rows: string[][] }

const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
function parseMd(text: string): MdBlock[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: MdBlock[] = []
  let i = 0
  const last = () => out[out.length - 1]
  while (i < lines.length) {
    const l = lines[i]
    const fence = l.match(/^\s*```\s*([\w+#.-]*)\s*$/)
    if (fence) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++])
      i++ // closing fence (an unclosed fence while streaming still renders as code)
      out.push({ k: 'code', lang: fence[1], code: body.join('\n') })
      continue
    }
    if (!l.trim()) {
      out.push({ k: 'p', lines: [] })
      i++
      continue
    }
    const h = l.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      out.push({ k: 'h', level: h[1].length, text: h[2] })
      i++
      continue
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) {
      out.push({ k: 'hr' })
      i++
      continue
    }
    if (l.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const head = cells(l)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]))
      out.push({ k: 'table', head, rows })
      continue
    }
    const q = l.match(/^\s*>\s?(.*)$/)
    if (q) {
      const b = last()
      if (b?.k === 'quote') b.lines.push(q[1])
      else out.push({ k: 'quote', lines: [q[1]] })
      i++
      continue
    }
    const li = l.match(/^(\s*)([-*+•]|(\d+)[.)])\s+(.*)$/)
    if (li) {
      const kind = li[3] ? 'ol' : 'ul'
      const depth = Math.min(3, Math.floor(li[1].replace(/\t/g, '  ').length / 2))
      const b = last()
      const item = { text: li[4], depth, n: li[3] ? Number(li[3]) : undefined }
      if (b && (b.k === 'ul' || b.k === 'ol') && (b.k === kind || depth > 0)) b.items.push(item)
      else out.push({ k: kind, items: [item] })
      i++
      continue
    }
    const b = last()
    if (b?.k === 'p' && b.lines.length) b.lines.push(l)
    else if ((b?.k === 'ul' || b?.k === 'ol') && /^\s{2,}\S/.test(l)) b.items[b.items.length - 1].text += ' ' + l.trim()
    else out.push({ k: 'p', lines: [l] })
    i++
  }
  return out.filter((b) => !(b.k === 'p' && !b.lines.length))
}

function Rich({ text }: { text: string }) {
  const blocks = useMemo(() => parseMd(text), [text])
  return (
    <div className="flex flex-col gap-2 [overflow-wrap:anywhere]">
      {blocks.map((b, i) => {
        switch (b.k) {
          case 'h':
            return <p key={i} className={`font-bold leading-snug ${b.level <= 2 ? 'mt-1 text-[1.12em]' : 'text-[1.02em]'}`}>{inline(b.text)}</p>
          case 'p':
            return <p key={i}>{b.lines.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l)}</span>)}</p>
          case 'ul':
          case 'ol':
            return (
              <ul key={i} className="flex flex-col gap-1">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2" style={{ paddingLeft: it.depth * 18 }}>
                    <span className={`shrink-0 select-none ${it.n !== undefined ? 'min-w-[1.3em] text-right font-semibold text-t-accent' : 'text-t-accent'}`} aria-hidden>{it.n !== undefined ? `${it.n}.` : it.depth ? '◦' : '•'}</span>
                    <span className="min-w-0">{inline(it.text)}</span>
                  </li>
                ))}
              </ul>
            )
          case 'quote':
            return <blockquote key={i} className="border-l-[3px] border-[#800000] pl-3 text-t-soft">{b.lines.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l)}</span>)}</blockquote>
          case 'code':
            return <CodeBlock key={i} code={b.code} lang={b.lang} />
          case 'hr':
            return <hr key={i} className="my-1 border-t-line" />
          case 'table':
            return (
              <div key={i} className="no-scrollbar my-1 overflow-x-auto rounded-lg border border-t-line">
                <table className="w-full border-collapse text-left text-[0.92em]">
                  <thead className="bg-t-tint/5">
                    <tr>{b.head.map((c, j) => <th key={j} className="border-b border-t-line px-3 py-2 font-semibold">{inline(c)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-b border-t-line/60 last:border-0">
                        {r.map((c, k) => <td key={k} className="px-3 py-2 align-top">{inline(c)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      })}
    </div>
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
  const msgsRef = useRef(msgs)
  msgsRef.current = msgs
  const abortRef = useRef<AbortController | null>(null)
  const [llm, setLlm] = useState<LlmConfig>(() => cleanLlm(load<unknown>('aoi.llm', () => null)))
  const [llmStatus, setLlmStatus] = useState<'unknown' | 'ok' | 'error' | 'unset'>(() => (usable(cleanLlm(load<unknown>('aoi.llm', () => null)).local) ? 'unknown' : 'unset'))
  useEffect(() => {
    try {
      localStorage.setItem('aoi.llm', JSON.stringify(llm))
    } catch {}
    setLlmStatus(usable(llm.local) ? 'unknown' : 'unset')
  }, [llm])
  const [input, setInput] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [phase, setPhase] = useState<'idle' | 'queued' | 'processing' | 'responding' | 'error'>('idle')
  const [listening, setListening] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const jobsRef = useRef<Job[]>([])
  const jobSeq = useRef(1)
  const [now, setNow] = useState(() => Date.now())
  const [pending, setPending] = useState<{ text: string; rewritten: string } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [view, setView] = useState<View>('login')
  const [user, setUser] = useState<User>(() => cleanUser(load<unknown>('aoi.user', () => null)) ?? userFrom('juan.delacruz@msuzs.edu.ph', '2024-00123'))
  const signOut = () => { newChat(); setSettingsOpen(false); setDrawerOpen(false); setAuditFocus(null); setView('login') }
  const [role, setRole] = useState<Role>(() => {
    const r = load<string>('aoi.role', () => 'Student')
    return r === 'Faculty' || r === 'Staff' ? r : 'Student'
  })
  const [audit, setAudit] = useState<AuditRow[]>(() => cleanAudit(load<unknown>('aoi.audit', () => null)) ?? HISTORY(Date.now()))
  const [cite, setCite] = useState<string | null>(null)
  const [auditFocus, setAuditFocus] = useState<string | null>(null)
  const idRef = useRef(1)
  const endRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const [attached, setAttached] = useState<string[]>([])
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [chats, setChats] = useState<Chat[]>(() => cleanChats(load<unknown>('aoi.chats', () => null)) ?? SEED_CHATS())
  const [activeId, setActiveId] = useState(() => Date.now())
  const [search, setSearch] = useState('')
  const [settings, setSettings] = useState<Settings>(() => cleanSettings(load<unknown>('aoi.settings', () => ({}))))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'general' | 'model'>('general')
  const [probe, setProbe] = useState<Record<'local' | 'external', { state: 'idle' | 'loading' | 'ok' | 'error'; msg: string; models: string[]; url: string }>>({
    local: { state: 'idle', msg: '', models: [], url: '' },
    external: { state: 'idle', msg: '', models: [], url: '' },
  })
  const testEndpoint = async (which: 'local' | 'external') => {
    // Same URL listModels() fetches, shown verbatim so a demo failure is diagnosable from the screen.
    const url = apiUrl(llm[which], '/models')
    setProbe((p) => ({ ...p, [which]: { ...p[which], state: 'loading', msg: `probing ${url} ...`, url } }))
    try {
      const models = await listModels(llm[which])
      setProbe((p) => ({ ...p, [which]: { state: 'ok', msg: `connected · ${models.length} model${models.length === 1 ? '' : 's'}`, models, url } }))
      if (!llm[which].model && models[0]) setLlm((c) => ({ ...c, [which]: { ...c[which], model: models[0] } }))
      if (which === 'local') setLlmStatus('ok')
    } catch (err) {
      setProbe((p) => ({ ...p, [which]: { state: 'error', msg: `unreachable · ${err instanceof Error ? err.message : 'Connection failed'}`, models: [], url } }))
      if (which === 'local') setLlmStatus('error')
    }
  }
  const setEp = (which: 'local' | 'external', patch: Partial<LlmEndpoint>) => setLlm((c) => ({ ...c, [which]: { ...c[which], ...patch } }))
  const [customBg, setCustomBg] = useState<string | null>(() => {
    try {
      const v = localStorage.getItem('aoi.bgimg')
      if (v && SAFE_BG.test(v)) return v
      if (v) localStorage.removeItem('aoi.bgimg')
      return null
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
    if (f.size > MAX_BG_BYTES) {
      setBgError('That image is over 15 MB. Please choose a smaller one.')
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
            : 'idle'

  const record = (cid: string, intent: string, mdl: string, path: string, external: boolean, wait = 0) =>
    setAudit((a) => [{ cid, ts: Date.now(), role, intent, model: mdl, path, external, wait: wait > 0 ? wait : undefined, user: user.email }, ...a].slice(0, 300))

  const commitJobs = (list: Job[]) => {
    jobsRef.current = list
    setJobs(list)
  }
  const enqueue = (mine: boolean, jobRole: Role, dept: string, dur: number): Job => {
    const t = Date.now()
    const live = jobsRef.current.filter((j) => j.end > t)
    const start = Math.max(t, live[live.length - 1]?.end ?? 0)
    const job = { id: jobSeq.current++, mine, role: jobRole, dept, arrived: t, start, end: start + dur }
    commitJobs([...live, job])
    setNow(t)
    return job
  }
  const leaveQueue = () => {
    if (!jobsRef.current.some((j) => j.mine)) return
    const t = Date.now()
    commitJobs(reschedule(jobsRef.current.filter((j) => !j.mine && j.end > t), t))
  }
  // Tick while anyone is in line; drop finished jobs.
  useEffect(() => {
    if (!jobs.length) return
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (jobsRef.current.some((j) => j.end <= t)) commitJobs(jobsRef.current.filter((j) => j.end > t))
    }, 250)
    return () => clearInterval(id)
  }, [jobs.length])

  // Streams the model's reply into the chat. Called by deliver() once the request has its GPU slot.
  const runModel = async (text: string, route: Route, wait: number, history: Msg[], files?: string[]) => {
    const ep = endpointFor(llm, route)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const id = idRef.current++
    const cid = newCid()
    const intent = { homework: 'Homework (guided)', policy: 'Policy', research: 'Research', general: 'General' }[route]
    // Research leaves the campus boundary, so the model only ever sees the anonymized prompt.
    const prompt = (route === 'research' ? anonymize(text) : text) + (files?.length ? `\n\n[Attached files: ${files.join(', ')}]` : '')
    const turns = history
      .filter((m) => !m.error && m.text.trim())
      .slice(-HISTORY_TURNS - 1, -1)
      .map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), content: route === 'research' && m.role === 'user' ? anonymize(m.text) : m.text }))
    const system = [SYSTEM_BASE, ROUTE_PROMPTS[route], MODE_PROMPTS[model] ?? ''].filter(Boolean).join('\n\n')
    let acc = ''
    let created = false
    let raf = 0
    const flush = () => {
      raf = 0
      setMsgs((m) => m.map((x) => (x.id === id ? { ...x, text: acc } : x)))
      follow()
    }
    // Send the selected mode id as `model` so the backend honors the user's choice; the audit
    // log records this same value (or 'None' when nothing could be sent).
    const sent = usable(ep) ? { ...ep, model } : ep
    const sentModel = usable(ep) ? model : 'None'
    try {
      await streamChat(sent, [{ role: 'system', content: system }, ...turns, { role: 'user', content: prompt }], ctrl.signal, (delta) => {
        acc += delta
        if (!created) {
          created = true
          setPhase('responding')
          setRevealId(id)
          setMsgs((m) => [...m, { id, role: 'aoi', text: acc, cid, time: stamp(), external: route === 'research' }])
        } else if (!raf) raf = requestAnimationFrame(flush)
      })
      cancelAnimationFrame(raf)
      if (!created) setMsgs((m) => [...m, { id, role: 'aoi', text: '_The model returned an empty reply. Try rephrasing or regenerating._', cid, time: stamp(), external: route === 'research' }])
      else flush()
      const path = { homework: 'Policy Guard → Guided', policy: 'Local RAG', research: ep === llm.external ? 'PII Stripper → External' : 'PII Stripper → Local', general: 'Local LLM' }[route]
      record(cid, intent, sentModel, path, route === 'research' && ep === llm.external, wait)
      setLlmStatus('ok')
      setRevealId(null)
      setPhase('idle')
    } catch (err) {
      cancelAnimationFrame(raf)
      if (ctrl.signal.aborted) return
      const kind = err instanceof LlmError ? err.kind : 'server'
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setLlmStatus(kind === 'config' ? 'unset' : 'error')
      record(cid, 'Error', sentModel, 'Error handler', false, wait)
      const note =
        kind === 'config'
          ? 'AOI isn’t connected to a language model yet. Add your model server in **Settings → Model connection**, then try again.'
          : kind === 'network'
            ? `${msg} Make sure it’s running and allows requests from this site (for Ollama, set \`OLLAMA_ORIGINS\`).`
            : msg
      if (created) setMsgs((m) => m.map((x) => (x.id === id ? { ...x, text: `${acc}\n\n_${msg}_` } : x)))
      else setMsgs((m) => [...m, { id, role: 'aoi', text: note, cid, time: stamp(), error: kind }])
      setRevealId(null)
      setPhase('error')
      later(() => setPhase('idle'), 2000)
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null
    }
  }

  const deliver = (text: string, route: Route) => {
    const files = attached.length ? attached : undefined
    const userMsg: Msg = { id: idRef.current++, role: 'user', text, time: stamp(), files }
    const history = [...msgsRef.current, userMsg]
    msgsRef.current = history
    setMsgs((m) => [...m, userMsg])
    setAttached([])
    // Policy and general answers are generated on the local GPU; homework guidance and research
    // still go through their own system prompts, and research may use the external endpoint.
    const job = route === 'policy' || route === 'general' ? enqueue(true, role, role === 'Admin' ? 'Admin' : 'You', GPU_JOB_MS) : null
    const wait = job ? job.start - job.arrived : 0
    setPhase(wait > 0 ? 'queued' : 'processing')
    later(() => {
      setPhase('processing')
      void runModel(text, route, wait, history, files)
    }, wait)
  }

  const send = (override?: string) => {
    const text = (override ?? input).trim().slice(0, MAX_MSG_CHARS)
    if (!text || phase === 'queued' || phase === 'processing' || phase === 'responding') return
    if (override === undefined) setInput('')
    if (override === undefined && editingId !== null) {
      // Edit & resend: drop the edited message and everything after it, then route as usual.
      const idx = msgsRef.current.findIndex((m) => m.id === editingId)
      if (idx >= 0) {
        msgsRef.current = msgsRef.current.slice(0, idx)
        setMsgs(msgsRef.current)
      }
      setEditingId(null)
    }
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

  const [autoAsk, setAutoAsk] = useState<string | null>(null)
  useEffect(() => {
    if (autoAsk === null || view !== 'chat') return
    const t = autoAsk
    setAutoAsk(null)
    send(t)
  })

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

  const liveJobs = jobs.filter((j) => j.end > now)
  const myJob = liveJobs.find((j) => j.mine)
  const waiting = liveJobs.filter((j) => j.start > now)
  const busy = phase === 'queued' || phase === 'processing' || phase === 'responding'
  const empty = msgs.length === 0
  const lastUserId = [...msgs].reverse().find((m) => m.role === 'user')?.id
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
  const [revealId, setRevealId] = useState<number | null>(null)
  const follow = () => {
    const t = mainRef.current
    if (t && t.scrollHeight - t.scrollTop - t.clientHeight < 160) endRef.current?.scrollIntoView({ block: 'end' })
  }
  const swipe = useRef<{ x: number; y: number; mode: 'open' | 'close'; locked: boolean } | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const asideRef = useRef<HTMLElement>(null)
  const { model, bgId } = settings
  const setModel = (m: ModelId) => setSettings((x) => ({ ...x, model: m }))
  const setBgId = (b: string) => setSettings((x) => ({ ...x, bgId: b }))
  // Desktop-only: hides the history column. The phone drawer ignores this.
  const collapsed = isDesktop && settings.sidebarCollapsed
  const toggleSidebar = () => setSettings((x) => ({ ...x, sidebarCollapsed: !x.sidebarCollapsed }))
  const dim = settings.bgDim / 100
  const bg =
    bgId === 'custom' && customBg
      ? { id: 'custom', name: 'Photo', css: `linear-gradient(rgba(0,0,0,${dim}),rgba(0,0,0,${dim})), url(${customBg}) center / cover no-repeat` }
      : (BACKGROUNDS.find((b) => b.id === bgId) ?? BACKGROUNDS[0])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
      if (view !== 'chat') return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        newChat()
        inputRef.current?.focus()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b' && isDesktop) {
        e.preventDefault()
        toggleSidebar()
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
        setCite(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const resetTransient = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    leaveQueue()
    setInput('')
    setEditingId(null)
    setAttached([])
    setRevealId(null)
    setPhase('idle')
    setPending(null)
    setListening(false)
    setDrawerOpen(false)
  }

  const stop = () => {
    const wasQueued = phase === 'queued'
    timers.current.forEach(clearTimeout)
    timers.current = []
    leaveQueue()
    abortRef.current?.abort()
    abortRef.current = null
    if (revealId !== null) {
      const id = revealId
      setMsgs((ms) => ms.map((m) => (m.id === id ? { ...m, text: m.text.trimEnd() ? `${m.text.trimEnd()}…` : '_Generation stopped._' } : m)))
      setRevealId(null)
    }
    setPhase('idle')
    showToast(wasQueued ? 'Left the GPU queue' : 'Generation stopped')
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

  const [toast, setToast] = useState('')
  const [toastOn, setToastOn] = useState(false)
  const toastTimer = useRef(0)
  const showToast = (t: string) => {
    setToast(t)
    setToastOn(true)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastOn(false), 1800)
  }
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const renameRef = useRef<number | null>(null)
  const startRename = (c: Chat) => {
    renameRef.current = c.id
    setRenamingId(c.id)
    setDraft(c.title)
  }
  const commitRename = () => {
    const id = renameRef.current
    renameRef.current = null
    const t = draft.trim()
    if (id !== null && t) {
      const old = chats.find((c) => c.id === id)?.title
      if (t !== old) {
        setChats((cs) => cs.map((c) => (c.id === id ? { ...c, title: t.slice(0, 60), renamed: true } : c)))
        showToast('Chat renamed')
      }
    }
    setRenamingId(null)
  }
  const cancelRename = () => {
    renameRef.current = null
    setRenamingId(null)
  }
  const togglePin = (id: number) => {
    const was = chats.find((c) => c.id === id)?.pinned
    setChats((cs) => cs.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)))
    showToast(was ? 'Unpinned' : 'Pinned to top')
  }

  const removeFile = (name: string) => {
    setAttached((a) => a.filter((x) => x !== name))
    setPreviews((p) => {
      if (p[name]) URL.revokeObjectURL(p[name])
      const { [name]: _gone, ...rest } = p
      return rest
    })
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
    showToast('Chat exported')
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
    msgsRef.current = msgs.slice(0, idx)
    setMsgs(msgsRef.current)
    send(text)
  }

  const startEdit = (m: Msg) => {
    setEditingId(m.id)
    setInput(m.text)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }
  const cancelEdit = () => {
    setEditingId(null)
    setInput('')
  }

  const copyMsg = (m: Msg) => {
    navigator.clipboard?.writeText(m.text).catch(() => {})
    setCopiedId(m.id)
    showToast('Copied!')
    window.setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1500)
  }

  const rate = (id: number, r: 'up' | 'down') =>
    setMsgs((ms) => ms.map((m) => (m.id === id ? { ...m, rating: m.rating === r ? undefined : r } : m)))

  useEffect(() => {
    // Persist once a streamed reply finishes rather than on every token.
    if (!msgs.length || revealId !== null) return
    const first = msgs.find((m) => m.role === 'user')?.text ?? 'New chat'
    const title = first.length > 34 ? first.slice(0, 34).trimEnd() + '…' : first
    setChats((cs) => {
      const i = cs.findIndex((c) => c.id === activeId)
      const next: Chat = { ...(i >= 0 ? cs[i] : {}), id: activeId, title: i >= 0 && cs[i].renamed ? cs[i].title : title, msgs, updated: Date.now() }
      if (i < 0) return [next, ...cs]
      const copy = [...cs]
      copy[i] = next
      return copy
    })
  }, [msgs, revealId])

  useEffect(() => {
    try {
      localStorage.setItem('aoi.chats', JSON.stringify(chats))
    } catch {}
  }, [chats])
  useEffect(() => {
    try {
      localStorage.setItem('aoi.role', JSON.stringify(role))
      localStorage.setItem('aoi.audit', JSON.stringify(audit))
    } catch {}
  }, [role, audit])
  useEffect(() => {
    try {
      localStorage.setItem('aoi.settings', JSON.stringify(settings))
      localStorage.setItem('aoi.user', JSON.stringify(user))
    } catch {}
  }, [settings, user])

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
    leaveQueue()
    setActiveId(Date.now())
    setAttached([])
    setPreviews((p) => {
      Object.values(p).forEach((u) => URL.revokeObjectURL(u))
      return {}
    })
    setMsgs([])
    setInput('')
    setPhase('idle')
    setPending(null)
    setListening(false)
    setEmptyVisible(true)
    setDrawerOpen(false)
  }

  const auditAll = useMemo(() => {
    const known = new Set(audit.map((r) => r.cid))
    const extra: AuditRow[] = []
    for (const c of chats)
      for (const m of c.msgs) {
        if (m.role !== 'aoi') continue
        const cid = m.cid ?? legacyCid(c.id, m.id)
        if (known.has(cid)) continue
        known.add(cid)
        extra.push({ ...synthRow(cid, c.updated, role, m), user: user.email })
      }
    const all = [...audit, ...extra].sort((a, b) => b.ts - a.ts)
    return role === 'Admin' ? all : all.filter((r) => r.user === user.email)
  }, [audit, chats, role, user.email])

  // Citations stay inside AOI: prefill a follow-up so the policy route answers from the local index.
  const askAboutSource = (label: string) => {
    const d = SOURCE_DOCS[label]
    setCite(null)
    if (!d) return
    setInput(`Regarding the ${d.title} (${d.ref}): `)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) }
    })
  }

  const toastEl = (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed left-1/2 z-[80] -translate-x-1/2 rounded-full bg-[#0A0A0A] px-4 py-2 text-[13px] font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-1 ring-white/15 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${toastOn ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
      style={{ bottom: 'calc(40px + var(--sa-bottom))' }}
    >
      {toast}
    </div>
  )

  if (view === 'login') {
    return (
      <div className="aoi-fade-in h-full w-full">
        <Login onLogin={(e, i) => { const u = userFrom(e, i); if (u.email !== user.email) { setChats(SEED_CHATS()); newChat() } setUser(u); setRole(u.role); setView('portal') }} />
      </div>
    )
  }

  if (view !== 'chat') {
    const home = () => {
      setView('portal')
    }
    return (
      <div
        className="relative mx-auto flex h-full w-full max-w-[430px] flex-col overflow-hidden pl-[var(--sa-left)] pr-[var(--sa-right)] text-t-fg transition-[background] duration-300 md:max-w-none"
        style={{ background: bg.css }}
      >
        <div key={view} className="aoi-fade-in min-h-0" style={{ zoom: TEXT_ZOOM[settings.fontSize], height: `${100 / TEXT_ZOOM[settings.fontSize]}%` }}>
          {view === 'portal' && (
            <Portal
              role={role}
              name={user.name}
              onAsk={(t) => { newChat(); setModel('aoi-general'); setView('chat'); setAutoAsk(t) }}
              avatar={<Avatar state="idle" width={isWide ? 190 : 112} />}
              onSignOut={signOut}
              counts={{ chats: chats.length, queries: auditAll.length, local: auditAll.length ? Math.round((auditAll.filter((r) => !r.external).length / auditAll.length) * 100) : 100 }}
              onOpen={(v) => {
                setAuditFocus(null)
                setView(v)
              }}
            />
          )}
          {view === 'account' && (
            <AccountSettings
              user={user}
              role={role}
              theme={settings.theme}
              setTheme={(t) => setSettings((x) => ({ ...x, theme: t }))}
              fontSize={settings.fontSize}
              setFontSize={(f) => setSettings((x) => ({ ...x, fontSize: f }))}
              showTime={settings.showTime}
              setShowTime={(b) => setSettings((x) => ({ ...x, showTime: b }))}
              chatCount={chats.length}
              onClearChats={clearAll}
              onReset={() => setSettings(DEFAULT_SETTINGS)}
              onHome={home}
              onSignOut={signOut}
            />
          )}
          {view === 'aoi' && <AoiProfile onBack={() => setView('chat')} aspect={LM_BODY.size[0] / LM_BODY.size[1]} renderFigure={(onPoke, w, talking) => <Avatar state={talking ? 'responding' : 'idle'} width={w} variant="body" onPoke={onPoke} />} />}
          {view === 'audit' && <AuditLog rows={auditAll} onHome={home} focusCid={auditFocus} admin={role === 'Admin'} />}
          {view === 'about' && <AboutAOI onHome={home} />}
          {view === 'research' && (
            <ResearchHub
              onHome={home}
              prompts={SUGGESTION_POOL.filter((x) => x.tag === 'Research').slice(0, 6)}
              onStart={(p) => {
                newChat()
                setView('chat')
                setAutoAsk(p)
              }}
            />
          )}
        </div>
        {toastEl}
      </div>
    )
  }

  return (
    <div
      className="relative mx-auto flex h-full w-full max-w-[430px] overflow-hidden pl-[var(--sa-left)] pr-[var(--sa-right)] md:max-w-none text-t-fg transition-[background] duration-300"
      style={{ background: bg.css, touchAction: 'pan-y' }}
      onPointerDown={(e) => {
        if (isDesktop || e.button > 0) return
        const left = e.currentTarget.getBoundingClientRect().left
        if (drawerOpen) swipe.current = { x: e.clientX, y: e.clientY, mode: 'close', locked: false }
        else if (e.clientX - left < 32) swipe.current = { x: e.clientX, y: e.clientY, mode: 'open', locked: false }
      }}
      onPointerMove={(e) => {
        const g = swipe.current
        if (!g) return
        const dx = e.clientX - g.x
        const dy = e.clientY - g.y
        if (!g.locked) {
          if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
            swipe.current = null
            return
          }
          if (Math.abs(dx) < 8) return
          g.locked = true
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {}
        }
        const w = asideRef.current?.offsetWidth ?? 300
        setDrag(Math.max(0, Math.min(w, (g.mode === 'open' ? 0 : w) + dx)))
      }}
      onPointerUp={() => {
        const g = swipe.current
        swipe.current = null
        if (g?.locked && drag !== null) setDrawerOpen(drag > (asideRef.current?.offsetWidth ?? 300) / 2)
        setDrag(null)
      }}
      onPointerCancel={() => {
        swipe.current = null
        setDrag(null)
      }}
    >
      <div aria-hidden className={`absolute inset-y-0 left-[var(--sa-left)] z-40 w-4 lg:hidden ${drawerOpen ? 'pointer-events-none' : ''}`} style={{ touchAction: 'none' }} />
      <div className={`absolute inset-0 z-50 lg:pointer-events-auto lg:relative lg:inset-auto lg:z-auto lg:shrink-0 lg:overflow-hidden lg:transition-[width] lg:duration-300 lg:ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? 'lg:w-0' : 'lg:w-[300px]'} ${drawerOpen ? '' : 'pointer-events-none'}`} aria-hidden={(!drawerOpen && !isDesktop) || collapsed}>
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] lg:hidden ${drag === null ? 'transition-opacity duration-300' : ''} ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
          style={drag !== null ? { opacity: drag / (asideRef.current?.offsetWidth || 300) } : undefined}
        />
        <aside
          ref={asideRef}
          style={drag !== null ? { transform: `translateX(${drag - (asideRef.current?.offsetWidth ?? 300)}px)`, transition: 'none' } : undefined}
          inert={(!drawerOpen && !isDesktop) || collapsed}
          aria-label="Navigation"
          className={`absolute inset-y-0 left-0 flex w-[84%] max-w-[320px] flex-col lg:w-[300px] lg:max-w-none lg:shadow-none ${collapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'} border-r border-t-surface bg-t-deep text-t-fg shadow-[8px_0_32px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
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
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[12px] font-semibold leading-none text-white shadow-[0_0_15px_rgba(128,0,0,0.4)] transition-all duration-200 ease-in-out hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #800000, #600000)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="shrink-0" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Chat
            </button>
          </div>

          <div className="px-4 pb-1">
            <label className="flex h-10 items-center gap-2 rounded-[12px] border border-t-surface bg-t-input px-3 transition-colors duration-200 ease-in-out focus-within:border-t-accent">
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

          <nav className="aoi-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3" style={{ touchAction: 'pan-y' }}>
            {(() => {
              const list = [...chats].filter((c) => c.title.toLowerCase().includes(search.toLowerCase())).sort((x, y) => y.updated - x.updated)
              const pinned = list.filter((c) => c.pinned)
              const rest = list.filter((c) => !c.pinned)
              const midnight = new Date().setHours(0, 0, 0, 0)
              const groups = [
                { label: 'Pinned', items: pinned },
                { label: 'Today', items: rest.filter((c) => c.updated >= midnight) },
                { label: 'Yesterday', items: rest.filter((c) => c.updated < midnight && c.updated >= midnight - DAY) },
                { label: 'Previous 7 Days', items: rest.filter((c) => c.updated < midnight - DAY && c.updated >= midnight - 7 * DAY) },
                { label: 'Older', items: rest.filter((c) => c.updated < midnight - 7 * DAY) },
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
                      {renamingId === c.id ? (
                        <input
                          autoFocus
                          value={draft}
                          maxLength={60}
                          aria-label="Chat name"
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename()
                            if (e.key === 'Escape') {
                              e.stopPropagation()
                              cancelRename()
                            }
                          }}
                          className="mx-2 my-1.5 h-8 min-w-0 flex-1 rounded-lg border border-[#800000] bg-t-input px-2.5 text-[14px] text-t-fg outline-none"
                        />
                      ) : (
                      <button type="button" onClick={() => selectChat(c.id)} onDoubleClick={() => startRename(c)} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left text-[14px]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                          <path d="M21 12a8 8 0 0 1-11.7 7.1L3 21l1.9-6.3A8 8 0 1 1 21 12z" />
                        </svg>
                        <span className="truncate">{c.title}</span>
                        {c.pinned && <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--accent)" className="shrink-0" aria-label="Pinned"><path d="M12 2l2.4 6.9H22l-6 4.6 2.3 7.2L12 16.2 5.7 20.7 8 13.5 2 8.9h7.6z" /></svg>}
                      </button>
                      )}
                      <button
                        type="button"
                        aria-label={c.pinned ? `Unpin ${c.title}` : `Pin ${c.title}`}
                        onClick={() => togglePin(c.id)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-t-subtle opacity-0 transition-all duration-200 ease-in-out hover:bg-t-tint/10 hover:text-t-accent focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      >
                        <svg {...ico} fill={c.pinned ? 'currentColor' : 'none'}><path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4z" /></svg>
                      </button>
                      <button
                        type="button"
                        aria-label={`Rename ${c.title}`}
                        onClick={() => startRename(c)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-t-subtle opacity-0 transition-all duration-200 ease-in-out hover:bg-t-tint/10 hover:text-t-accent focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      >
                        <svg {...ico}><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
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
            <div className="mt-0.5 flex items-center gap-1 rounded-[10px] px-3 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#800000] text-[12px] font-bold text-white">{initials(user.name)}</span>
              <span className="min-w-0 flex-1 pl-2">
                <span className="block truncate text-[14px] font-medium">{user.name}</span>
                <span className="block text-[12px] text-t-muted">Account · {role}</span>
              </span>
              <button type="button" onClick={signOut} aria-label="Log out" title="Log out" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-t-muted transition-colors duration-200 hover:bg-[#800000] hover:text-white active:scale-90">
                <svg {...ico} width={17} height={17}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
      <header
        className={`relative z-30 grid h-[calc(3.5rem+var(--sa-top))] shrink-0 pt-[var(--sa-top)] grid-cols-[1fr_auto_1fr] items-center border-b px-3 md:px-6 lg:flex lg:justify-between shadow-elev-1 transition-colors duration-300 ease-in-out border-t-line bg-t-surface text-t-fg`}
      >
        <div className="flex items-center gap-0.5 justify-self-start">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 ease-in-out hover:bg-t-tint/10 active:bg-t-tint/10"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={collapsed ? 'Show chat history' : 'Hide chat history'}
            aria-expanded={!collapsed}
            title={`${collapsed ? 'Show' : 'Hide'} chat history (Ctrl+B)`}
            onClick={toggleSidebar}
            className="hidden h-10 w-10 items-center justify-center rounded-full text-t-muted transition-colors duration-200 ease-in-out hover:bg-t-tint/10 hover:text-t-fg active:scale-90 lg:flex"
          >
            <svg {...ico} width={20} height={20}>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
          {collapsed && (
            <button
              type="button"
              aria-label="New chat"
              title="New chat (Ctrl+K)"
              onClick={newChat}
              className="aoi-fade-in hidden h-10 w-10 items-center justify-center rounded-full text-t-muted transition-colors duration-200 ease-in-out hover:bg-t-tint/10 hover:text-t-fg active:scale-90 lg:flex"
            >
              <svg {...ico} width={20} height={20}>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </button>
          )}
          <button
            type="button"
            aria-label="Back to Portal"
            title="Back to Portal"
            onClick={() => setView('portal')}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 ease-in-out hover:bg-t-tint/10 active:scale-90"
          >
            <HomeIcon />
          </button>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={modelOpen}
            onClick={() => setModelOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] font-semibold transition-colors duration-200 ease-in-out hover:bg-t-tint/10"
          >
            {MODELS.find((m) => m.id === model)?.name ?? model}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${modelOpen ? 'rotate-180' : ''}`} aria-hidden>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {modelOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setModelOpen(false)} />
              <div
                role="menu"
                className="aoi-menu absolute left-1/2 top-full z-50 mt-2 w-[264px] -translate-x-1/2 lg:left-0 lg:translate-x-0 rounded-2xl border border-t-line2 bg-t-surface p-1.5 text-t-fg shadow-elev-3"
              >
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={model === m.id}
                    onClick={() => {
                      setModel(m.id)
                      setModelOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 ease-in-out hover:bg-t-tint/10 focus-visible:bg-t-tint/10 focus-visible:outline-none ${model === m.id ? 'bg-[#800000]/10' : ''}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[14px] font-semibold">
                        {m.name}
                        <span className="rounded-full bg-[#800000]/40 px-1.5 py-px text-[10px] font-medium text-t-accent">{m.tag}</span>
                      </span>
                      <span className="mt-0.5 block text-[12px] text-t-muted">{m.desc}</span>
                    </span>
                    {model === m.id && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    )}
                  </button>
                ))}
                <div aria-hidden className="mx-2 my-1 h-px bg-t-line" />
                <button
                  type="button"
                  onClick={() => {
                    setModelOpen(false)
                    setSettingsTab('model')
                    setSettingsOpen(true)
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[12px] transition-colors hover:bg-t-tint/10"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${llmStatus === 'ok' ? 'bg-emerald-500' : llmStatus === 'error' ? 'bg-red-500' : llmStatus === 'unset' ? 'bg-amber-500' : 'bg-t-subtle'}`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-t-muted">
                    {llmStatus === 'unset' ? 'No model connected' : <><span className="font-mono text-t-soft">{llm.local.model}</span>{llmStatus === 'error' ? ' · unreachable' : llmStatus === 'ok' ? ' · connected' : ''}</>}
                  </span>
                  <span className="shrink-0 font-semibold text-t-accent">Connection</span>
                </button>
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
            aria-label="Open AOI's character profile"
            title="AOI's profile"
            onClick={() => setView('aoi')}
            className="rounded-full transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            <Avatar state={avatarState} width={32} variant="face" />
          </button>
        </div>
      </header>

      <div
        className="grid shrink-0 transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: liveJobs.length ? '1fr' : '0fr' }}
        aria-hidden={!liveJobs.length}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex items-center gap-2 bg-t-surface/80 px-4 py-1.5 text-[12px] text-t-soft backdrop-blur-md md:px-6" role="status">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#B01E2E] opacity-60" />
              <span className="relative h-2 w-2 rounded-full bg-[#B01E2E]" />
            </span>
            <span className="min-w-0 truncate">
              <b className="font-semibold text-t-fg">Campus GPU</b> · RTX 4050 6 GB · serving 1
              {waiting.length > 0 && <> · <b className="font-mono text-t-fg">{waiting.length}</b> waiting</>}
            </span>
            <span className="ml-auto hidden shrink-0 text-[11px] text-t-muted sm:inline">First come, first served</span>
          </div>
          <p className="border-b border-t-line bg-t-surface/80 px-4 pb-1.5 text-[11px] text-t-subtle backdrop-blur-md md:px-6">Queue simulation for demonstration. See backend /health for model status.</p>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <main
          ref={mainRef}
          onScroll={(e) => {
            const t = e.currentTarget
            setAtBottom(t.scrollHeight - t.scrollTop - t.clientHeight < 80)
          }}
          className="aoi-scroll relative min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6"
        >
          {emptyVisible && (
            <div className={`absolute inset-0 flex flex-col items-center px-4 pb-3 text-center ${empty ? 'aoi-fade-in' : 'aoi-fade-out pointer-events-none'}`}>
              <div className="flex flex-1 flex-col items-center justify-center pt-4 md:pt-10 md:short:pt-2">
                <div className="relative">
                  <span
                    className="aoi-breathe absolute -inset-14 rounded-full blur-xl md:-inset-20"
                    style={{ background: 'radial-gradient(circle at 30% 35%, rgba(56,189,248,0.45) 0%, transparent 55%), radial-gradient(circle at 72% 70%, rgba(176,30,46,0.55) 0%, transparent 58%)' }}
                  />
                  <span
                    className="absolute -inset-6 rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(125,211,252,0.18) 0%, transparent 70%)' }}
                  />
                  <div className="[mask-image:linear-gradient(to_bottom,#000_70%,transparent)] [mask-repeat:no-repeat]">
                    <Avatar state={avatarState} width={isWide ? 200 : 112} />
                  </div>
                </div>
                <h1 className="relative mt-3 max-w-[260px] text-[22px] md:mt-8 md:max-w-[480px] md:text-[30px] md:short:mt-4 md:short:text-[26px] font-bold leading-snug tracking-tight text-t-fg">
                  Hi, I’m AOI. How can I help you today?
                </h1>
                {llmStatus === 'unset' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsTab('model')
                      setSettingsOpen(true)
                    }}
                    className="relative mt-3 flex min-h-[44px] max-w-full items-center gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 py-2 pl-2 pr-3.5 text-left text-[12.5px] font-medium leading-snug text-t-fg transition-colors hover:bg-amber-500/20 md:mt-4 md:min-h-0 md:rounded-full md:py-1.5"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/25 text-amber-500">
                      <svg {...ico} width={14} height={14}><path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
                    </span>
                    <span className="min-w-0">No language model connected yet. <span className="whitespace-nowrap font-semibold text-t-accent">Connect one</span></span>
                  </button>
                )}
              </div>
              <div className="mt-3 grid w-full min-w-0 max-w-[760px] grid-cols-1 gap-2 md:mt-5 md:grid-cols-3 md:gap-3 md:short:mt-3">
                {ideas.map((s, i) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => {
                      setInput(s.prompt)
                      inputRef.current?.focus()
                    }}
                    style={{ animationDelay: `${0.1 + i * 0.08}s` }}
                    className="aoi-in group flex min-h-[44px] min-w-0 items-center gap-3 rounded-2xl border border-t-tint/10 bg-t-surface/60 px-3.5 py-2.5 text-left md:px-4 md:py-3 shadow-elev-2 backdrop-blur-md transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-t-accent hover:bg-[#800000]/15 active:scale-[0.98] md:flex-col md:items-start md:gap-2 md:p-4"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#800000]/30 md:h-9 md:w-9 text-t-accent transition-colors duration-200 ease-in-out group-hover:bg-[#800000]/60 group-hover:text-t-fg">
                      <svg {...ico} width={18} height={18}>
                        {TAG_ICONS[s.tag]}
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-t-accent">{s.tag}</span>
                      <span className="mt-0.5 block text-[13px] font-semibold text-t-fg">{s.title}</span>
                      <span className="mt-0.5 block truncate text-[12px] leading-snug text-t-muted md:whitespace-normal">{s.hint}</span>
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
                      <span className="whitespace-pre-wrap break-words">{m.text}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {m.id === lastUserId && !busy && editingId !== m.id && (
                        <ActionBtn label="Edit message" onClick={() => startEdit(m)}>
                          <svg {...ico}><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
                        </ActionBtn>
                      )}
                      {settings.showTime && <span className="px-1 text-[10px] font-medium uppercase tracking-[0.5px] text-t-subtle">{m.time}</span>}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="aoi-in flex max-w-[92%] items-start gap-2.5 md:max-w-[88%]">
                    <div className="mt-0.5 shrink-0">
                      <Avatar state="idle" width={30} variant="face" />
                    </div>
                    <div className="flex min-w-0 flex-col items-start gap-1">
                    <span className="px-1 text-[11px] font-semibold tracking-wide text-t-soft">AOI</span>
                    <div
                      className={`min-w-0 max-w-full break-words rounded-[20px] rounded-bl-[4px] border px-4 py-3 leading-relaxed text-t-fg shadow-elev-2 backdrop-blur-[10px] ${m.error ? 'border-[#B01E2E]/50 bg-[#800000]/10' : 'border-t-tint/10 bg-t-surface/80'}`}
                    >
                      <Rich text={m.text} />
                      {m.id === revealId && <span className="aoi-caret" aria-hidden />}
                      {m.error && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {m.error === 'config' ? (
                            <button type="button" onClick={() => { setSettingsOpen(true); setSettingsTab('model') }} className="rounded-full bg-[#800000] px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-all hover:brightness-110 active:scale-95">
                              Connect a model
                            </button>
                          ) : (
                            <button type="button" onClick={() => { setSettingsOpen(true); setSettingsTab('model') }} className="rounded-full border border-t-line2 px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-t-tint/10 active:scale-95">
                              Check connection
                            </button>
                          )}
                          {m.id === msgs[msgs.length - 1].id && !busy && (
                            <button type="button" onClick={regenerate} className="rounded-full border border-t-line2 px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-t-tint/10 active:scale-95">
                              Try again
                            </button>
                          )}
                        </div>
                      )}
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
                      {!m.error && (<>
                      <ActionBtn label="Good response" active={m.rating === 'up'} onClick={() => rate(m.id, 'up')}>
                        <svg {...ico} fill={m.rating === 'up' ? 'currentColor' : 'none'}><path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2.3l-1.2 6.5a2 2 0 0 1-2 1.7H7" /></svg>
                      </ActionBtn>
                      <ActionBtn label="Bad response" active={m.rating === 'down'} onClick={() => rate(m.id, 'down')}>
                        <svg {...ico} fill={m.rating === 'down' ? 'currentColor' : 'none'}><path d="M17 13V4h3v9zM17 13l-4 8a2 2 0 0 1-2-2v-4H5a2 2 0 0 1-2-2.3l1.2-6.5A2 2 0 0 1 6.2 4H17" /></svg>
                      </ActionBtn>
                      </>)}
                      {m.id === msgs[msgs.length - 1].id && !busy && !m.error && (
                        <ActionBtn label="Regenerate" onClick={regenerate}>
                          <svg {...ico}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
                        </ActionBtn>
                      )}
                    </div>
                    {m.sources && m.id !== revealId && (
                      <div className="aoi-fade-in mt-1 flex flex-wrap items-center gap-1.5">
                        {m.external && <span className="text-[12px] text-t-muted">Sources:</span>}
                        {m.sources.map((s) => (
                          <SourceChip key={s} label={s} external={m.external} onOpen={setCite} />
                        ))}
                      </div>
                    )}
                    {m.id !== revealId && (
                      <button
                        type="button"
                        title="View in System Audit Log"
                        onClick={() => {
                          setAuditFocus(m.cid ?? legacyCid(activeId, m.id))
                          setView('audit')
                        }}
                        className="aoi-fade-in px-1 font-mono text-[10px] tracking-wide text-t-subtle transition-colors hover:text-t-accent"
                      >
                        ID: {m.cid ?? legacyCid(activeId, m.id)}
                      </button>
                    )}
                    </div>
                  </div>
                ),
              )}
              {phase === 'queued' && myJob && (
                <div className="aoi-in flex items-start gap-2.5" aria-live="polite" aria-label="Waiting in the GPU queue">
                  <div className="mt-0.5 shrink-0">
                    <Avatar state="idle" width={30} variant="face" />
                  </div>
                  <div className="w-full max-w-[360px] rounded-[20px] rounded-bl-[4px] border border-t-tint/10 bg-t-surface/80 px-4 py-3 backdrop-blur-[10px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-semibold">
                        You're <span className="font-mono text-t-accent">#{liveJobs.indexOf(myJob) + 1}</span> in line
                      </span>
                      <span className="font-mono text-[11.5px] text-t-muted">~{secs(myJob.start - now)}</span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-t-muted">The campus GPU answers one request at a time. These inquiries arrived before yours:</p>
                    <ol className="mt-2.5 flex flex-col gap-1.5">
                      {liveJobs.slice(0, liveJobs.indexOf(myJob)).map((j, i) => {
                        const running = j.start <= now
                        return (
                          <li key={j.id} className="flex items-center gap-2 text-[12px]">
                            <span className="w-4 shrink-0 font-mono text-t-subtle">{i + 1}</span>
                            <span className={`rounded px-1.5 py-px text-[10.5px] font-bold uppercase tracking-[0.06em] ${j.role === 'Faculty' ? 'bg-[#800000] text-white' : 'border border-t-line2 text-t-soft'}`}>{j.role}</span>
                            <span className="min-w-0 flex-1 truncate text-t-muted">{j.dept} · asked {secs(now - j.arrived)} ago</span>
                            <span className={`shrink-0 font-mono text-[11px] ${running ? 'text-t-accent' : 'text-t-subtle'}`}>{running ? `generating · ${secs(j.end - now)}` : 'waiting'}</span>
                          </li>
                        )
                      })}
                    </ol>
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-t-tint/10">
                      <div
                        className="h-full rounded-full bg-[#800000] transition-[width] duration-300 ease-linear"
                        style={{ width: `${Math.min(100, Math.max(4, ((now - myJob.arrived) / Math.max(1, myJob.start - myJob.arrived)) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
              {(phase === 'processing' || phase === 'responding') && msgs[msgs.length - 1]?.role === 'user' && (
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
            className="aoi-in absolute bottom-3 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-t-tint/10 bg-t-surface/90 text-t-fg shadow-elev-2 backdrop-blur-md transition-all duration-200 ease-in-out hover:border-t-accent"
          >
            <svg {...ico} width={18} height={18}><path d="M12 5v14M5 12l7 7 7-7" /></svg>
          </button>
        )}
      </div>

      <footer
        className="shrink-0 px-4 pt-2 md:px-6"
        style={{ paddingBottom: 'calc(12px + var(--sa-bottom))' }}
      >
        {attached.length > 0 && (
          <div className="mx-auto mb-2 flex max-w-[800px] flex-wrap gap-1.5">
            {attached.map((f) => (
              <span key={f} className="aoi-in flex items-center gap-1.5 rounded-full border border-t-tint/10 bg-t-surface/80 py-1 pl-3 pr-1.5 text-[12px] text-t-soft">
                {previews[f] && <img src={previews[f]} alt="" className="-ml-1.5 h-6 w-6 rounded-full object-cover" />}
                <span className="max-w-[180px] truncate">{f}</span>
                <button type="button" aria-label={`Remove ${f}`} onClick={() => removeFile(f)} className="flex h-5 w-5 items-center justify-center rounded-full text-t-muted transition-colors duration-200 ease-in-out hover:bg-t-tint/10 hover:text-t-fg">
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
            const picked = Array.from(e.target.files ?? [])
            const files = picked.filter((f) => f.size <= MAX_ATTACH_BYTES)
            e.target.value = ''
            if (files.length < picked.length) {
              showToast('Files must be 10 MB or smaller')
              if (!files.length) return
            }
            const fresh = files.filter((f) => !attached.includes(f.name)).slice(0, Math.max(0, 4 - attached.length))
            if (files.length > fresh.length) showToast(attached.length + fresh.length >= 4 ? 'Up to 4 files per message' : 'File already attached')
            if (fresh.length) {
              setAttached((a) => [...a, ...fresh.map((f) => f.name)])
              setPreviews((p) => ({ ...p, ...Object.fromEntries(fresh.filter((f) => f.type.startsWith('image/')).map((f) => [f.name, URL.createObjectURL(f)])) }))
            }
          }}
        />
        {llmStatus === 'error' && (
          <p role="status" className="mx-auto mb-2 flex max-w-[800px] items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12.5px] leading-snug text-t-fg">
            <svg {...ico} width={14} height={14} className="mt-[2px] shrink-0 text-red-400" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
            <span>
              On-campus model unreachable. Check <code className="rounded bg-t-tint/10 px-1 font-mono text-[0.92em]">VITE_AOI_LLM_URL</code> or that ProBook:8000 is running.
            </span>
          </p>
        )}
        {listening && <p className="mx-auto mb-2 max-w-[800px] text-center text-[12px] font-medium text-t-accent">Listening… tap the mic to stop</p>}
        {editingId !== null && (
          <div role="status" className="aoi-in mx-auto mb-2 flex max-w-[800px] items-center gap-2 rounded-xl border border-t-line2 bg-t-surface/80 py-1.5 pl-3 pr-1.5 text-[12.5px] text-t-soft backdrop-blur-md">
            <svg {...ico} width={14} height={14} className="shrink-0 text-t-accent" aria-hidden><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
            <span className="min-w-0 flex-1 truncate">Editing your last message. Send to replace it and get a new reply.</span>
            <button type="button" onClick={cancelEdit} className="shrink-0 rounded-lg px-2.5 py-1 font-semibold text-t-fg transition-colors hover:bg-t-tint/10">
              Cancel
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setPressed(true)
            navigator.vibrate?.(8)
            send()
          }}
          className="mx-auto flex w-full max-w-[800px] items-end gap-0.5 rounded-[24px] border border-t-tint/10 bg-t-surface/60 p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[16px] transition-all duration-200 ease-in-out focus-within:border-t-accent focus-within:shadow-[0_2px_8px_rgba(0,0,0,0.08),0_0_0_1px_#800000,0_0_18px_rgba(128,0,0,0.3)]"
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
            maxLength={MAX_MSG_CHARS}
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
          {busy || revealId !== null ? (
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
        <div className="mx-auto mt-2 flex max-w-[800px] items-center justify-between gap-3 px-2 text-[11px] text-t-subtle">
          <span className="hidden md:inline">
            <kbd className="rounded border border-t-line px-1 font-sans">Enter</kbd> to send · <kbd className="rounded border border-t-line px-1 font-sans">Shift</kbd> + <kbd className="rounded border border-t-line px-1 font-sans">Enter</kbd> for a new line
          </span>
          <span className="min-w-0 flex-1 truncate text-center md:flex-none">AOI can make mistakes. Verify with the registrar.</span>
          <span className={`shrink-0 font-mono tabular-nums ${input.length > MAX_MSG_CHARS * 0.9 ? 'text-red-400' : ''} ${input.length > MAX_MSG_CHARS * 0.75 ? '' : 'invisible'}`} aria-live="polite">
            {input.length}/{MAX_MSG_CHARS}
          </span>
        </div>
      </footer>
      </div>

      <SourceSheet label={cite} onClose={() => setCite(null)} onAsk={askAboutSource} />

      <div className={`absolute inset-0 z-[60] flex items-end justify-center ${sheetOpen ? '' : 'pointer-events-none'}`} aria-hidden={!sheetOpen}>
        <div
          onClick={() => setSheetOpen(false)}
          className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${sheetOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          inert={!sheetOpen}
          role="dialog"
          aria-label="Chat background"
          className={`relative w-full md:max-w-[480px] rounded-t-[24px] border-t border-t-tint/10 bg-t-deep px-5 pt-3 text-t-fg transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${sheetOpen ? 'translate-y-0 shadow-[0_-12px_40px_rgba(0,0,0,0.6)]' : 'translate-y-full shadow-none'}`}
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

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed left-1/2 z-[80] -translate-x-1/2 rounded-full bg-[#0A0A0A] px-4 py-2 text-[13px] font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-1 ring-white/15 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${toastOn ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
        style={{ bottom: 'calc(96px + var(--sa-bottom))' }}
      >
        {toast}
      </div>

      {settingsOpen && (
        <div className="aoi-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-5 backdrop-blur-[8px]" role="dialog" aria-modal="true" aria-label="Settings" onClick={() => setSettingsOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="aoi-spring no-scrollbar max-h-[90vh] w-full max-w-[400px] overflow-y-auto rounded-[20px] border border-t-line bg-t-surface p-5 text-t-fg shadow-elev-3 md:max-w-[500px] md:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-bold">Settings</h2>
              <button type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-t-muted transition-colors duration-200 ease-in-out hover:bg-t-tint/10 hover:text-t-fg">
                <svg {...ico} width={18} height={18}><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div role="tablist" aria-label="Settings sections" className="mt-4 grid grid-cols-2 gap-1 rounded-[12px] bg-t-bg p-1">
              {([['general', 'General'], ['model', 'Model connection']] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={settingsTab === k}
                  onClick={() => setSettingsTab(k)}
                  className={`flex items-center justify-center gap-1.5 rounded-[9px] py-2 text-[13.5px] font-semibold transition-all ${settingsTab === k ? 'bg-t-surface text-t-fg shadow-elev-1' : 'text-t-muted hover:text-t-fg'}`}
                >
                  {label}
                  {k === 'model' && <span className={`h-1.5 w-1.5 rounded-full ${llmStatus === 'ok' ? 'bg-emerald-500' : llmStatus === 'error' ? 'bg-red-500' : llmStatus === 'unset' ? 'bg-amber-500' : 'bg-t-subtle'}`} aria-hidden />}
                </button>
              ))}
            </div>

            {settingsTab === 'model' && (
              <div className="mt-5 flex flex-col gap-4">
                <p className="text-[12.5px] leading-relaxed text-t-muted">
                  AOI talks to any OpenAI-compatible server, such as Ollama, LM Studio, vLLM or llama.cpp running on the campus GPU. Settings are saved in this browser.
                </p>
                {(['local', 'external'] as const).map((which) => {
                  const ep = llm[which]
                  const pr = probe[which]
                  const listId = `aoi-models-${which}`
                  return (
                    <section key={which} className="rounded-2xl border border-t-line p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-[14px] font-bold">{which === 'local' ? 'On-campus model' : 'External research model'}</h3>
                          <p className="mt-0.5 text-[12px] text-t-muted">
                            {which === 'local' ? 'Answers general, policy and study-help questions.' : 'Optional. Receives anonymized research prompts only, after consent. Leave empty to keep research on campus.'}
                          </p>
                        </div>
                        {which === 'local' && (
                          <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] ${llmStatus === 'ok' ? 'bg-emerald-500/15 text-emerald-500' : llmStatus === 'error' ? 'bg-red-500/15 text-red-400' : llmStatus === 'unset' ? 'bg-amber-500/15 text-amber-500' : 'bg-t-tint/10 text-t-muted'}`}>
                            {llmStatus === 'ok' ? 'Connected' : llmStatus === 'error' ? 'Unreachable' : llmStatus === 'unset' ? 'Not set' : 'Untested'}
                          </span>
                        )}
                      </div>
                      {which === 'local' && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {[
                            ['Ollama', 'http://localhost:11434/v1'],
                            ['LM Studio', 'http://localhost:1234/v1'],
                            ['llama.cpp', 'http://localhost:8080/v1'],
                          ].map(([name, url]) => (
                            <button key={name} type="button" onClick={() => setEp('local', { baseUrl: url })} className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${ep.baseUrl === url ? 'border-[#800000] bg-[#800000]/15 text-t-accent' : 'border-t-line2 text-t-muted hover:text-t-fg'}`}>
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                      <label className="mt-3 block text-[11.5px] font-semibold uppercase tracking-[0.06em] text-t-muted">
                        Server URL
                        <input
                          value={ep.baseUrl}
                          onChange={(e) => setEp(which, { baseUrl: e.target.value.trim() })}
                          placeholder={which === 'local' ? 'http://localhost:11434/v1' : 'https://your-proxy.example.edu/v1'}
                          spellCheck={false}
                          inputMode="url"
                          maxLength={300}
                          className="mt-1 h-10 w-full rounded-[10px] border border-t-line bg-t-input px-3 font-mono text-[12.5px] normal-case tracking-normal text-t-fg outline-none focus:border-t-accent"
                        />
                      </label>
                      <label className="mt-2.5 block text-[11.5px] font-semibold uppercase tracking-[0.06em] text-t-muted">
                        Model
                        <input
                          value={ep.model}
                          onChange={(e) => setEp(which, { model: e.target.value })}
                          list={listId}
                          placeholder={which === 'local' ? 'e.g. llama3.1:8b' : 'e.g. meta-llama/llama-3.1-70b-instruct'}
                          spellCheck={false}
                          maxLength={120}
                          className="mt-1 h-10 w-full rounded-[10px] border border-t-line bg-t-input px-3 font-mono text-[12.5px] normal-case tracking-normal text-t-fg outline-none focus:border-t-accent"
                        />
                        <datalist id={listId}>{pr.models.map((m) => <option key={m} value={m} />)}</datalist>
                      </label>
                      {which === 'external' && (
                        <label className="mt-2.5 block text-[11.5px] font-semibold uppercase tracking-[0.06em] text-t-muted">
                          API key (optional)
                          <input
                            type="password"
                            autoComplete="off"
                            value={ep.apiKey}
                            onChange={(e) => setEp(which, { apiKey: e.target.value })}
                            maxLength={400}
                            className="mt-1 h-10 w-full rounded-[10px] border border-t-line bg-t-input px-3 font-mono text-[12.5px] normal-case tracking-normal text-t-fg outline-none focus:border-t-accent"
                          />
                          <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-t-subtle">Keys entered here live in this browser. For a shared deployment, put cloud keys behind a university server proxy instead.</span>
                        </label>
                      )}
                      <div className="mt-3 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void testEndpoint(which)}
                          disabled={pr.state === 'loading' || !ep.baseUrl}
                          className="h-9 shrink-0 rounded-[10px] bg-[#800000] px-3.5 text-[13px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
                        >
                          {pr.state === 'loading' ? 'Testing…' : 'Test connection'}
                        </button>
                        {pr.msg && (
                          <span role="status" className={`min-w-0 break-all text-[12px] leading-snug ${pr.state === 'ok' ? 'text-emerald-500' : pr.state === 'error' ? 'text-red-400' : 'text-t-muted'}`}>
                            {pr.msg}
                            {pr.state !== 'loading' && pr.url && <span className="mt-0.5 block font-mono text-[11px] text-t-subtle">GET {pr.url}</span>}
                          </span>
                        )}
                      </div>
                    </section>
                  )
                })}
                <p className="text-[11.5px] leading-relaxed text-t-subtle">
                  Running Ollama? Allow this site with <code className="rounded bg-t-tint/10 px-1">OLLAMA_ORIGINS=*</code> (or this site’s address) before starting it, so the browser can reach it.
                </p>
              </div>
            )}

            {settingsTab === 'general' && (<>

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
              <span className="hidden lg:inline"><kbd className="rounded border border-t-line px-1">Ctrl</kbd> + <kbd className="rounded border border-t-line px-1">B</kbd> Sidebar</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setSettings(DEFAULT_SETTINGS)} className="h-11 flex-1 rounded-[12px] border border-t-line2 bg-t-tint/5 text-[14px] font-semibold transition-all duration-200 ease-in-out hover:bg-t-tint/10 active:scale-[0.98]">
                Reset
              </button>
              <button type="button" onClick={clearAll} className="h-11 flex-1 rounded-[12px] border border-[#800000] bg-[#800000]/20 text-[14px] font-semibold text-t-accent transition-all duration-200 ease-in-out hover:bg-[#800000]/40 active:scale-[0.98]">
                Clear all chats
              </button>
            </div>
            <button type="button" onClick={signOut} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] text-[14px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #B01E2E, #800000 55%, #4a0000)' }}>
              <svg {...ico} width={16} height={16}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>
              Log out
            </button>
            </>)}
          </div>
        </div>
      )}

      {pending && (
        <div className="aoi-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-[8px]" role="dialog" aria-modal="true" aria-labelledby="consent-title">
          <div className="aoi-spring no-scrollbar max-h-[90vh] w-full max-w-[380px] overflow-y-auto md:max-w-[560px] md:p-6 rounded-[20px] border border-t-line bg-t-surface p-5 text-t-fg shadow-elev-3">
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
              Your query is anonymized in two layers. Review exactly what leaves the university below.
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
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-t-muted">PII Stripper preview</p>
                <button type="button" aria-expanded={showPreview} onClick={() => setShowPreview((v) => !v)} className="text-[12px] font-medium text-t-accent hover:underline">
                  {showPreview ? 'Done editing' : 'Edit rewritten prompt'}
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-[12px] border border-t-line bg-t-bg p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-t-muted">Before</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-t-fg" aria-label="Original prompt">
                    {detectPII(pending.text).map((seg, i) =>
                      seg.layer ? (
                        <mark key={i} className={`rounded px-1 text-t-fg ${seg.layer === 1 ? 'bg-[#800000]/35' : 'bg-sky-400/30'}`}>
                          {seg.text}
                        </mark>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      ),
                    )}
                  </p>
                </div>
                <div className="rounded-[12px] border border-[#800000]/60 bg-[#800000]/10 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-t-accent">After</p>
                  {showPreview ? (
                    <textarea
                      value={pending.rewritten}
                      onChange={(e) => setPending((p) => (p ? { ...p, rewritten: e.target.value } : p))}
                      rows={4}
                      aria-label="Rewritten prompt"
                      className="mt-1.5 w-full resize-none rounded-lg border border-t-line bg-t-bg p-2 text-[12.5px] leading-relaxed text-t-fg outline-none focus:border-t-accent"
                    />
                  ) : (
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-t-fg" aria-label="Rewritten prompt">{pending.rewritten}</p>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-t-muted">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#800000]/60" />Layer 1 · Pattern strip (names, IDs, contacts)</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-sky-400/60" />Layer 2 · Generalize (course → subject)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
