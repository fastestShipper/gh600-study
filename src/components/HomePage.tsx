import type { Route } from '../App'
import { ALL_QUESTIONS, DOMAINS, META } from '../lib/exam'
import { EXAM_HEADER_LABEL } from '../config'

interface HomePageProps {
  onGo: (r: Route) => void
}

const DOMAIN_COLORS = [
  'from-amber-400/30 to-amber-600/10',
  'from-violet-400/30 to-violet-600/10',
  'from-sky-400/30 to-sky-600/10',
  'from-emerald-400/30 to-emerald-600/10',
  'from-rose-400/30 to-rose-600/10',
  'from-cyan-400/30 to-cyan-600/10',
]

export default function HomePage({ onGo }: HomePageProps) {
  return (
    <div className="space-y-8 fade-up">
      <section>
        {EXAM_HEADER_LABEL && (
          <div className="chip chip-accent mb-3">{EXAM_HEADER_LABEL}</div>
        )}
        <h1 className="text-4xl lg:text-5xl font-display font-semibold tracking-tight text-ink">
          {META.exam_code}: {META.exam_title}
        </h1>
        <p className="mt-3 text-ink-dim max-w-3xl leading-relaxed">
          Your goal: maximize your score on the {META.exam_code} ({META.credential}). This app is
          your cram pack for the days before the exam. Plain language, no fluff. Built from the
          official Microsoft study guide, GitHub Docs, and the people who already took the beta.
        </p>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard kpi={`${META.duration_minutes} min`} label="Duration" hint="Real clock" />
        <StatCard kpi="40–60" label="Questions" hint="Scenario-based" />
        <StatCard kpi="700" label="Pass score" hint="/ 1000 to pass" />
        <StatCard kpi="6" label="Domains" hint="See weights below" />
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-display font-semibold text-ink mb-1">
          What the GH-600 is, in one line
        </h2>
        <p className="text-ink-dim leading-relaxed">
          It's GitHub's first cert for people who <strong className="text-ink">operate, supervise,
          and govern AI agents</strong> (Copilot cloud agent, Copilot CLI, custom agents) inside the
          software development lifecycle, with GitHub as the control plane. It's not a coding exam;
          it's an exam about <em>how you configure, evaluate, and put guardrails on</em> agents
          that write code for you.
        </p>
        <div className="mt-4 grid lg:grid-cols-2 gap-3 text-sm">
          <Bullet good>You will see questions about custom-agent YAML, MCP servers, firewall allowlists, CODEOWNERS, environments with required reviewers.</Bullet>
          <Bullet good>Almost everything is <strong>scenario-based</strong>: you get context, then have to pick the BEST option, not the only one.</Bullet>
          <Bullet bad>What you will NOT see: rote trivia about Copilot Chat, basic git commands, or non-agentic Actions syntax.</Bullet>
          <Bullet bad>Classic trap: confusing <code className="text-accent">--no-ask-user</code> with <code className="text-accent">--autopilot</code>, or assuming the firewall covers MCP servers (it does not).</Bullet>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-xl font-display font-semibold text-ink">The 6 domains and their weights</h2>
          <button onClick={() => onGo('domains')} className="btn btn-ghost text-xs">
            See cheatsheets ▸
          </button>
        </div>
        <div className="grid lg:grid-cols-2 gap-3">
          {DOMAINS.map((d, idx) => (
            <button
              key={d.domain_id}
              onClick={() => onGo('domains')}
              className={`card card-hover p-4 text-left bg-gradient-to-br ${DOMAIN_COLORS[idx]}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-mono text-ink-dim">D{d.domain_id}</div>
                <div className="chip">{d.weight_pct}</div>
              </div>
              <div className="font-display text-ink font-medium leading-snug">{d.title}</div>
              <div className="text-xs text-ink-dim mt-1">
                {d.objectives.length} objectives · {d.objectives.reduce(
                  (a, o) => a + (o.questions?.length ?? 0),
                  0,
                )}{' '}
                exam-style questions
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="grid lg:grid-cols-3 gap-3">
        <ActionCard
          title="Start with the plan"
          desc="3-day intensive schedule. Check each block as you finish it."
          cta="Open plan ▸"
          onClick={() => onGo('plan')}
        />
        <ActionCard
          title="Read the cheatsheet"
          desc="Glossary, paths, CLI commands, and the gotchas that always show up. Memorize them."
          cta="Open cheatsheet ▸"
          onClick={() => onGo('cheatsheet')}
        />
        <ActionCard
          title="Drill questions"
          desc={`${ALL_QUESTIONS.length} scenario questions with explanations. Filter by domain to reinforce weak spots.`}
          cta="Open practice ▸"
          onClick={() => onGo('practice')}
        />
      </section>

      <section className="grid lg:grid-cols-2 gap-3">
        <article className="card p-5">
          <div className="chip chip-warn mb-2">EXAM LOGISTICS</div>
          <h2 className="text-lg font-display font-semibold text-ink mb-3">
            Non-obvious things that matter on exam day
          </h2>
          <ul className="space-y-2 text-sm text-ink-dim leading-relaxed">
            <li className="flex gap-2"><span className="text-warn mt-0.5">▸</span><span><strong className="text-ink">No Microsoft Learn during the exam.</strong> Walk in with paths, commands, and key differences already in your head.</span></li>
            <li className="flex gap-2"><span className="text-warn mt-0.5">▸</span><span><strong className="text-ink">Exam is English-only.</strong> If English is not your first language, Microsoft lets you request <strong>+30 minutes</strong> at booking time. That's 120+30 = 150 min total.</span></li>
            <li className="flex gap-2"><span className="text-warn mt-0.5">▸</span><span><strong className="text-ink">Beta runs through May 31, 2026</strong>, GA in July 2026. 80% off code for the first 100 candidates: <code className="text-accent mono">GH600Flanders</code>.</span></li>
            <li className="flex gap-2"><span className="text-warn mt-0.5">▸</span><span>Not available in Turkey, Pakistan, India, or China. Beta results take <strong>8–12 weeks</strong>.</span></li>
            <li className="flex gap-2"><span className="text-warn mt-0.5">▸</span><span>Sandbox to get familiar with the UI: <code className="text-accent mono text-[11px]">ghcertdemo.starttest.com</code></span></li>
            <li className="flex gap-2"><span className="text-warn mt-0.5">▸</span><span>There is no official Practice Assessment. This app and the jtur671 mock are the only drill banks you get.</span></li>
          </ul>
        </article>

        <article className="card p-5">
          <div className="chip chip-purple mb-2">BETA TESTIMONIALS · MAY 2026</div>
          <h2 className="text-lg font-display font-semibold text-ink mb-3">
            What people who already took it say
          </h2>
          <div className="space-y-4">
            <div className="border-l-2 border-accent/60 pl-3">
              <div className="text-xs text-ink-mute font-mono mb-1">Reasonable_East_3023 · author of the public Gist</div>
              <p className="text-sm text-ink-dim leading-relaxed italic">
                "This exam kicks ass. Way harder than GH-300. Microsoft Learn is only a high-level
                map. The exam is very practical: YAML, MCP JSON, session logs, workflows with needs
                and artifacts, hooks, Copilot CLI. Treat the guide as a workbook."
              </p>
            </div>
            <div className="border-l-2 border-accent-2/60 pl-3">
              <div className="text-xs text-ink-mute font-mono mb-1">Luciano_DZ · took it the same day as the author</div>
              <p className="text-sm text-ink-dim leading-relaxed italic">
                "56 questions plus 2 case studies. Heavy emphasis on GitHub Actions workflows for
                agents and on Copilot CLI. Master the basic CLI commands and how to author agent
                files under .github/. No Microsoft Learn access during the exam."
              </p>
            </div>
            <div className="border-l-2 border-info/60 pl-3">
              <div className="text-xs text-ink-mute font-mono mb-1">Another beta taker · on the question format</div>
              <p className="text-sm text-ink-dim leading-relaxed italic">
                "Not everything is multiple choice. There are drag-and-drop items and fill-in-the-blank
                with predefined choices. Read carefully; they show you real snippets."
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="card p-6 border-accent/30">
        <h2 className="text-lg font-display font-semibold text-ink mb-2">
          Recommended approach if you have ~3 days
        </h2>
        <ol className="space-y-2 text-sm text-ink-dim leading-relaxed list-decimal list-inside">
          <li>
            <strong className="text-ink">Day 1:</strong> Read the cheatsheet end to end, then focus
            on Domain 2 (the heaviest, 20–25%) plus Domain 6 (guardrails, 10–15%). Drill ~30
            questions filtered to those domains.
          </li>
          <li>
            <strong className="text-ink">Day 2:</strong> Domains 5, 1, 4, 3. Walk through the 12
            artifact labs back to back. Run a timed Mock Exam in the evening. Review every miss.
          </li>
          <li>
            <strong className="text-ink">Day 3 morning:</strong> One more Mock Exam (questions
            rotate). Final pass through gotchas + paths + commands. Leave 30 min buffer to get to
            the test center.
          </li>
        </ol>
        <div className="mt-3 text-xs text-ink-mute">
          Block-by-block schedule lives in the <em>Cram plan</em> tab.
        </div>
      </section>
    </div>
  )
}

function StatCard({ kpi, label, hint }: { kpi: string; label: string; hint: string }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-display font-bold text-ink">{kpi}</div>
      <div className="text-sm text-ink-dim">{label}</div>
      <div className="text-[11px] text-ink-mute mt-0.5">{hint}</div>
    </div>
  )
}

function Bullet({ children, good, bad }: { children: React.ReactNode; good?: boolean; bad?: boolean }) {
  const dot = good ? 'bg-good' : bad ? 'bg-bad' : 'bg-ink-mute'
  return (
    <div className="flex gap-2 text-ink-dim leading-relaxed">
      <div className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <div>{children}</div>
    </div>
  )
}

function ActionCard({
  title,
  desc,
  cta,
  onClick,
}: {
  title: string
  desc: string
  cta: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="card card-hover p-5 text-left group">
      <div className="font-display font-semibold text-ink">{title}</div>
      <div className="text-sm text-ink-dim mt-1 leading-relaxed">{desc}</div>
      <div className="text-xs text-accent mt-3 group-hover:underline">{cta}</div>
    </button>
  )
}
