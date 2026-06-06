// Wave XXX-AE: "How It Works" — coordinator-facing visual guide.
// Designed for Ashley + Samantha at Priority Lexus (45yo aftermarket coordinators
// who live in /deals every day). Plain English, lots of color, scannable at a glance.
import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import Rocket from 'lucide-react/dist/esm/icons/rocket.js'
import Clock from 'lucide-react/dist/esm/icons/clock.js'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import Wrench from 'lucide-react/dist/esm/icons/wrench.js'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js'
import Undo2 from 'lucide-react/dist/esm/icons/undo-2.js'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js'
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid.js'
import Table from 'lucide-react/dist/esm/icons/table.js'
import Columns3 from 'lucide-react/dist/esm/icons/columns-3.js'
import MousePointer2 from 'lucide-react/dist/esm/icons/mouse-pointer-2.js'
import Move from 'lucide-react/dist/esm/icons/move.js'
import GripVertical from 'lucide-react/dist/esm/icons/grip-vertical.js'
import Search from 'lucide-react/dist/esm/icons/search.js'
import Filter from 'lucide-react/dist/esm/icons/filter.js'
import AlertTriangle from 'lucide-react/dist/esm/icons/triangle-alert.js'
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3.js'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js'

// ── Lifecycle data ───────────────────────────────────────────────
const LIFECYCLE = [
  {
    name: 'Pending Work',
    icon: Clock,
    color: 'slate',
    bg: 'bg-slate-50',
    border: 'border-slate-300',
    text: 'text-slate-700',
    accent: 'bg-slate-500',
    desc: 'A new deal. Sold but not yet scheduled or started.',
  },
  {
    name: 'Scheduled',
    icon: Calendar,
    color: 'blue',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-700',
    accent: 'bg-blue-500',
    desc: 'A start time is booked. The vendor or shop is locked in.',
  },
  {
    name: 'In Progress',
    icon: Wrench,
    color: 'amber',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-700',
    accent: 'bg-amber-500',
    desc: 'Work is happening right now. Wrench in the car.',
  },
  {
    name: 'Completed',
    icon: CheckCircle2,
    color: 'emerald',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-700',
    accent: 'bg-emerald-500',
    desc: 'Done. Delivered to the customer. Counted in the totals.',
  },
  {
    name: 'Reversed',
    icon: Undo2,
    color: 'red',
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-700',
    accent: 'bg-red-500',
    desc: 'Cancelled, refunded, no-show. Backed out with a reason.',
  },
]

// ── Views data ───────────────────────────────────────────────────
const VIEWS = [
  {
    name: 'Card View',
    icon: LayoutGrid,
    gradient: 'from-blue-500 to-indigo-600',
    bestFor: 'Working through deals one at a time. You see every detail.',
    howTo: 'Default view — already on it.',
  },
  {
    name: 'Sheet View',
    icon: Table,
    gradient: 'from-emerald-500 to-teal-600',
    bestFor: 'Scanning many deals fast, like a spreadsheet. Read-only.',
    howTo: 'Click the "Sheet" button next to the filter bar.',
  },
  {
    name: 'Board View',
    icon: Columns3,
    gradient: 'from-purple-500 to-fuchsia-600',
    bestFor: 'Seeing the whole pipeline. Drag deals to change status.',
    howTo: 'Click the "Board" button next to the filter bar.',
  },
]

// ── Common tasks data ────────────────────────────────────────────
const TASKS = [
  {
    icon: Calendar,
    color: 'blue',
    title: 'Schedule a deal',
    steps: ['Open a Pending Work deal', 'Click "Schedule"', 'Pick a date + time'],
  },
  {
    icon: Undo2,
    color: 'red',
    title: 'Reverse a deal',
    steps: [
      'Open the deal',
      'Click the red "Reverse Deal" button',
      'Type why (refund, no-show, etc.)',
    ],
  },
  {
    icon: AlertTriangle,
    color: 'amber',
    title: 'See only overdue work',
    steps: ['Click "Overdue" in the navbar', 'Sorted by how late they are'],
  },
  {
    icon: Search,
    color: 'slate',
    title: 'Find a customer',
    steps: ['Go to Deals', 'Type their name in the search box', 'Live filter as you type'],
  },
  {
    icon: Filter,
    color: 'purple',
    title: 'Filter by status',
    steps: [
      'On the Deals page, tap a status tab',
      'Pending Work / Scheduled / Completed / Reversed',
    ],
  },
  {
    icon: BarChart3,
    color: 'emerald',
    title: "See this month's numbers",
    steps: ['Look at the KPI tiles at the top of Home or Deals', 'Gross, reversals, net'],
  },
]

// ── Animation variants ───────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

const HowItWorks = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* ─────────────── HERO ─────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm ring-2 ring-white/20 mb-6"
          >
            <Rocket className="w-10 h-10 text-white" />
          </motion.div>
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight"
          >
            How Rocket Works
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto"
          >
            Your aftermarket coordinator dashboard, in plain English.
          </motion.p>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              to="/deals"
              className="inline-flex items-center gap-2 bg-white text-slate-900 px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-100 transition-colors"
            >
              Go to Deals
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#lifecycle"
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white px-5 py-2.5 rounded-lg font-semibold ring-1 ring-white/20 hover:bg-white/20 transition-colors"
            >
              Start the tour
            </a>
          </motion.div>
        </div>
      </div>

      {/* ─────────────── THE LIFECYCLE ─────────────── */}
      <section id="lifecycle" className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full text-xs font-semibold text-slate-600 uppercase tracking-wider mb-4">
            <Sparkles className="w-3 h-3" />
            The Big Idea
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
            Every deal lives one of 5 lives
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            From the second a deal is sold, it moves through these states. That's the whole game.
          </p>
        </motion.div>

        {/* Lifecycle horizontal flow — desktop */}
        <div className="hidden md:flex items-stretch gap-2 justify-center">
          {LIFECYCLE.map((stage, idx) => {
            const Icon = stage.icon
            return (
              <React.Fragment key={stage.name}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.08, duration: 0.4 }}
                  className={`flex-1 max-w-[180px] rounded-2xl border-2 ${stage.border} ${stage.bg} p-4 text-center`}
                >
                  <div
                    className={`mx-auto w-12 h-12 rounded-xl ${stage.accent} flex items-center justify-center mb-3`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className={`font-bold text-base ${stage.text} mb-1`}>{stage.name}</div>
                  <div className="text-xs text-slate-600 leading-snug">{stage.desc}</div>
                </motion.div>
                {idx < LIFECYCLE.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.08 + 0.2 }}
                    className="flex items-center text-slate-400"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </motion.div>
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Lifecycle vertical stack — mobile */}
        <div className="md:hidden space-y-3">
          {LIFECYCLE.map((stage, idx) => {
            const Icon = stage.icon
            return (
              <motion.div
                key={stage.name}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
                className={`rounded-xl border-2 ${stage.border} ${stage.bg} p-4 flex items-start gap-3`}
              >
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-lg ${stage.accent} flex items-center justify-center`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-base ${stage.text}`}>{stage.name}</div>
                  <div className="text-sm text-slate-600 mt-0.5">{stage.desc}</div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Lifecycle callout */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mt-8 max-w-3xl mx-auto bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-3"
        >
          <Sparkles className="flex-shrink-0 w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <strong>The frozen rule:</strong> once a deal hits <em>Completed</em> or{' '}
            <em>Reversed</em>, it stays there forever. That's how the month's totals stay honest —
            no one can quietly undo history.
          </div>
        </motion.div>
      </section>

      {/* ─────────────── THREE VIEWS ─────────────── */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-1.5 bg-white px-3 py-1 rounded-full text-xs font-semibold text-slate-600 uppercase tracking-wider mb-4 border border-slate-200">
              <LayoutGrid className="w-3 h-3" />
              Three Views
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
              Same deals, three ways to see them
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Pick the view that matches what you're trying to do right now.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {VIEWS.map((view, idx) => {
              const Icon = view.icon
              return (
                <motion.div
                  key={view.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.4 }}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className={`bg-gradient-to-br ${view.gradient} p-6 text-white`}>
                    <Icon className="w-10 h-10 mb-3" />
                    <div className="text-xl font-bold">{view.name}</div>
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Best for
                      </div>
                      <div className="text-sm text-slate-700 leading-snug">{view.bestFor}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        How to switch
                      </div>
                      <div className="text-sm text-slate-700 leading-snug">{view.howTo}</div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─────────────── BOARD HOW-TO (drag and drop) ─────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-1.5 bg-purple-100 px-3 py-1 rounded-full text-xs font-semibold text-purple-700 uppercase tracking-wider mb-4">
            <Move className="w-3 h-3" />
            The Board (new)
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
            Drag deals where they go
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            On the Board view, you don't open a menu to change a deal's status. You just{' '}
            <em>move it</em>.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              n: '1',
              icon: MousePointer2,
              title: 'Click "Board"',
              body: 'Top of the Deals page. Switches you to the column view.',
            },
            {
              n: '2',
              icon: GripVertical,
              title: 'Grab a card',
              body: 'Click and hold. The card lifts — you\'ll see it tilt with a shadow.',
            },
            {
              n: '3',
              icon: Move,
              title: 'Drop it on a column',
              body: 'The target column lights up blue. Let go — the status changes.',
            },
          ].map((step, idx) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.4 }}
                className="bg-white rounded-2xl border-2 border-purple-200 p-6 relative"
              >
                <div className="absolute -top-3 -left-3 w-9 h-9 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {step.n}
                </div>
                <Icon className="w-8 h-8 text-purple-600 mb-3" />
                <div className="font-bold text-lg text-slate-900 mb-2">{step.title}</div>
                <div className="text-sm text-slate-600 leading-snug">{step.body}</div>
              </motion.div>
            )
          })}
        </div>

        {/* Reverse warning callout */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mt-8 max-w-3xl mx-auto bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3"
        >
          <Undo2 className="flex-shrink-0 w-5 h-5 text-red-600 mt-0.5" />
          <div className="text-sm text-red-900">
            <strong>Heads up:</strong> dragging a deal to the <em>Reversed</em> column always asks
            why first. You'll see a modal pop up. Type the reason (refund, no-show, etc.) and click{' '}
            <em>Reverse Deal</em>. The deal won't move until you confirm.
          </div>
        </motion.div>
      </section>

      {/* ─────────────── COMMON TASKS ─────────────── */}
      <section className="bg-gradient-to-b from-slate-50 to-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-1.5 bg-emerald-100 px-3 py-1 rounded-full text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-4">
              <CheckCircle2 className="w-3 h-3" />
              Cheat Sheet
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
              How do I...?
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              The 6 things you'll do most days.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TASKS.map((task, idx) => {
              const Icon = task.icon
              const colorMap = {
                blue: 'bg-blue-100 text-blue-700 border-blue-200',
                red: 'bg-red-100 text-red-700 border-red-200',
                amber: 'bg-amber-100 text-amber-700 border-amber-200',
                slate: 'bg-slate-100 text-slate-700 border-slate-200',
                purple: 'bg-purple-100 text-purple-700 border-purple-200',
                emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
              }
              return (
                <motion.div
                  key={task.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05, duration: 0.3 }}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all"
                >
                  <div
                    className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${colorMap[task.color]} mb-3`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-base text-slate-900 mb-2">{task.title}</div>
                  <ol className="space-y-1.5 text-sm text-slate-600">
                    {task.steps.map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span
                          className={`flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${colorMap[task.color]}`}
                        >
                          {i + 1}
                        </span>
                        <span className="leading-snug">{step}</span>
                      </li>
                    ))}
                  </ol>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─────────────── COLOR LEGEND ─────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="bg-slate-900 rounded-3xl p-8 sm:p-10 text-white"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Color legend</h2>
            <p className="text-slate-400">What every color in the app actually means.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {LIFECYCLE.map((stage) => (
              <div
                key={stage.name}
                className="flex items-center gap-2 bg-white/5 rounded-lg p-3"
              >
                <div className={`w-4 h-4 rounded ${stage.accent} flex-shrink-0`} />
                <div className="text-sm font-medium truncate">{stage.name}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 bg-white/5 rounded-lg p-3">
              <div className="w-4 h-4 rounded bg-blue-200 ring-1 ring-blue-500 flex-shrink-0" />
              <div className="text-sm">
                <strong>On-site</strong>{' '}
                <span className="text-slate-400">— work done at Priority Lexus</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/5 rounded-lg p-3">
              <div className="w-4 h-4 rounded bg-purple-200 ring-1 ring-purple-500 flex-shrink-0" />
              <div className="text-sm">
                <strong>Vendor / Off-site</strong>{' '}
                <span className="text-slate-400">— a vendor handles it</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─────────────── FOOTER CTA ─────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-20 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
        >
          <p className="text-lg text-slate-700 mb-5">
            That's it. The rest you'll figure out by clicking around.
          </p>
          <Link
            to="/deals"
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-800 transition-colors"
          >
            Open Deals
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </section>
    </div>
  )
}

export default HowItWorks
