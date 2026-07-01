"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  Bot,
  CheckCircle2,
  Database,
  FileCheck2,
  FileText,
  Fingerprint,
  LockKeyhole,
  MailCheck,
  Network,
  ShieldCheck,
  Sparkles,
  Trophy,
  UploadCloud,
} from "lucide-react"

const productCapabilities = [
  "Secure token-based upload portal",
  "AI analysis against request criteria and checklists",
  "Missing-document email drafts for accountant approval",
  "Off-chain sensitive files with on-chain proof hashes",
]

const workflow = [
  ["Request", "Accountant sends a secure upload link", MailCheck],
  ["Upload", "Client submits documents through the portal", UploadCloud],
  ["Analyze", "AI detects missing or risky materials", Bot],
  ["Prove", "GIWA records receipt and completion hashes", Fingerprint],
] as const

const marketRows = [
  ["Addressable market", "14,000+ registered tax accountants (세무사) in Korea"],
  ["First workflow", "Monthly bookkeeping material collection"],
  ["Expansion", "Compliance-heavy document workflows"],
  ["Business model", "B2B SaaS — tiered by number of client companies"],
]

const milestones = [
  "Deploy proof registry on GIWA testnet",
  "Connect proof worker to upload and completion events",
  "Show explorer links in the accountant review screen",
  "Validate a pilot-ready demo with one accounting office",
  "Secure a signed pilot agreement with at least one accounting firm",
]

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
      {children}
    </p>
  )
}

function SlideShell({
  children,
  dark = false,
}: {
  children: React.ReactNode
  dark?: boolean
}) {
  return (
    <section
      className={[
        "grid min-h-[calc(100svh-96px)] content-center rounded-lg border p-6 shadow-sm sm:p-8 lg:p-10",
        dark
          ? "border-stone-800 bg-stone-950 text-white"
          : "border-stone-200 bg-white text-stone-950",
      ].join(" ")}
    >
      {children}
    </section>
  )
}

function StatStrip() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ["AI SaaS", "Built around a real accounting workflow", "sky"],
        ["GIWA proof", "Hash-based receipt and completion records", "emerald"],
        ["Pilot path", "Accounting office MVP validation", "amber"],
      ].map(([title, copy, color]) => (
        <div
          className={[
            "border-l-2 pl-4",
            color === "sky"
              ? "border-sky-500"
              : color === "emerald"
                ? "border-emerald-500"
                : "border-amber-500",
          ].join(" ")}
          key={title}
        >
          <p className="text-2xl font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6 text-stone-600">{copy}</p>
        </div>
      ))}
    </div>
  )
}

export function GasokPitchDeck() {
  const [current, setCurrent] = useState(0)

  const slides = useMemo(
    () => [
      {
        title: "Cover",
        node: (
          <SlideShell>
            <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="flex flex-col justify-between gap-10">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold">JARYO</div>
                  <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">
                    GASOK Track 04. AI / WEB3
                  </div>
                </div>
                <div>
                  <Label>AI document workflow with GIWA proof</Label>
                  <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl">
                    Verifiable document collection for accounting firms.
                  </h1>
                  <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-700">
                    JARYO automates bookkeeping document requests, missing-file
                    checks, and follow-up email drafts with AI. GIWA adds
                    proof-of-receipt without exposing sensitive documents
                    on-chain.
                  </p>
                </div>
                <StatStrip />
              </div>
              <div className="flex items-center">
                <div className="w-full rounded-lg border border-stone-200 bg-stone-950 p-4 text-white shadow-2xl shadow-stone-200">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                    <div className="size-2 rounded-full bg-red-400" />
                    <div className="size-2 rounded-full bg-amber-300" />
                    <div className="size-2 rounded-full bg-emerald-400" />
                    <span className="ml-3 text-xs text-stone-400">
                      jaaryo.online/pitch/gasok
                    </span>
                  </div>
                  <div className="grid gap-3 py-5">
                    {workflow.map(([label, detail, Icon], index) => (
                      <div
                        className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] p-3"
                        key={label}
                      >
                        <div className="flex size-11 items-center justify-center rounded-md bg-white text-stone-950">
                          <Icon className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            {index + 1}. {label}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-stone-400">
                            {detail}
                          </p>
                        </div>
                        {index < workflow.length - 1 ? (
                          <ArrowRight className="size-4 text-stone-500" />
                        ) : (
                          <CheckCircle2 className="size-4 text-emerald-300" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </SlideShell>
        ),
      },
      {
        title: "Problem",
        node: (
          <SlideShell>
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <Label>Problem</Label>
                <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
                  Monthly document collection still runs on repeated manual
                  chasing.
                </h2>
                <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4">
                  <p className="text-3xl font-semibold">3–5×</p>
                  <p className="mt-1 text-sm leading-6 text-stone-600">
                    Average follow-up exchanges per client each month — just to
                    collect standard documents.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  [
                    "Scattered submission",
                    "Clients send partial files in different formats and channels.",
                  ],
                  [
                    "Manual checking",
                    "Accountants open files one by one to compare them with request criteria.",
                  ],
                  [
                    "Weak audit trail",
                    "Internal database records alone are not strong external proof of receipt.",
                  ],
                ].map(([title, copy]) => (
                  <div
                    className="rounded-lg border border-stone-200 bg-stone-50 p-5"
                    key={title}
                  >
                    <FileText className="size-5 text-sky-700" />
                    <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-stone-600">
                      {copy}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </SlideShell>
        ),
      },
      {
        title: "Solution",
        node: (
          <SlideShell>
            <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
              <div>
                <Label>Solution</Label>
                <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
                  One workflow for request, upload, AI review, and verifiable
                  completion.
                </h2>
                <p className="mt-5 text-base leading-7 text-stone-700">
                  The accountant stays in control, while AI handles the first
                  pass and GIWA anchors the proof layer.
                </p>
              </div>
              <div className="grid gap-3">
                {productCapabilities.map((capability) => (
                  <div
                    className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4"
                    key={capability}
                  >
                    <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
                    <p className="text-sm font-medium leading-6">
                      {capability}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </SlideShell>
        ),
      },
      {
        title: "Why GIWA",
        node: (
          <SlideShell>
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <Label>Why GIWA</Label>
                <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
                  Independently verifiable receipt history without public
                  private documents.
                </h2>
              </div>
              <div className="grid gap-4">
                {[
                  [
                    "No raw files on-chain",
                    "Original documents, filenames, business IDs, emails, amounts, and employee data stay off-chain.",
                  ],
                  [
                    "Proof at two key moments",
                    "JARYO records file receipt hashes and session completion hashes on GIWA Sepolia.",
                  ],
                  [
                    "No wallet burden for clients",
                    "Proof transactions run in the background, then appear as explorer links.",
                  ],
                ].map(([title, copy]) => (
                  <div
                    className="rounded-lg border border-stone-200 bg-stone-50 p-5"
                    key={title}
                  >
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="size-5 text-emerald-600" />
                      <h3 className="font-semibold">{title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-stone-600">
                      {copy}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </SlideShell>
        ),
      },
      {
        title: "Architecture",
        node: (
          <SlideShell dark>
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Architecture
                </p>
                <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
                  AI does the workflow reasoning. GIWA records the proof
                  boundary.
                </h2>
              </div>
              <div className="grid gap-3">
                {[
                  [UploadCloud, "Client upload", "Private file storage"],
                  [Database, "JARYO backend", "SHA-256 hash and workflow state"],
                  [Bot, "AI analysis", "Missing-material detection"],
                  [Blocks, "GIWA Chain Testnet", "File and session proof events"],
                ].map(([Icon, title, detail]) => {
                  const TypedIcon = Icon as typeof UploadCloud

                  return (
                    <div
                      className="grid grid-cols-[48px_1fr] gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-4"
                      key={title as string}
                    >
                      <div className="flex size-12 items-center justify-center rounded-md bg-white text-stone-950">
                        <TypedIcon className="size-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{title as string}</h3>
                        <p className="mt-1 text-sm leading-6 text-stone-400">
                          {detail as string}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </SlideShell>
        ),
      },
      {
        title: "Market",
        node: (
          <SlideShell>
            <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
              <div>
                <Label>Market</Label>
                <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
                  Starting with accounting firms, expanding to document-heavy
                  compliance workflows.
                </h2>
              </div>
              <div className="overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
                {marketRows.map(([label, value]) => (
                  <div
                    className="grid gap-2 border-b border-stone-200 p-4 last:border-b-0 sm:grid-cols-[160px_1fr]"
                    key={label}
                  >
                    <p className="text-sm font-semibold text-stone-500">
                      {label}
                    </p>
                    <p className="text-sm font-medium text-stone-900">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </SlideShell>
        ),
      },
      {
        title: "Team",
        node: (
          <SlideShell>
            <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
              <div>
                <Label>Team</Label>
                <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
                  Solo founder with AI and Web3 execution experience.
                </h2>
                <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <Trophy className="mt-0.5 size-5 text-amber-700" />
                  <p className="text-sm leading-6 text-amber-950">
                    Winner of the NEAR track at BUIDL Asia 2026, with hands-on
                    experience shipping blockchain products under tight
                    timelines.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  [Sparkles, "AI workflow", "Document analysis and draft generation"],
                  [Network, "Web3 proof", "EVM-compatible proof registry design"],
                  [FileCheck2, "MVP progress", "Upload, analysis, and email flows"],
                  [LockKeyhole, "Privacy posture", "Off-chain data, on-chain hashes"],
                ].map(([Icon, title, copy]) => {
                  const TypedIcon = Icon as typeof Sparkles

                  return (
                    <div
                      className="rounded-lg border border-stone-200 bg-stone-50 p-5"
                      key={title as string}
                    >
                      <TypedIcon className="size-5 text-sky-700" />
                      <h3 className="mt-4 font-semibold">{title as string}</h3>
                      <p className="mt-2 text-sm leading-6 text-stone-600">
                        {copy as string}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </SlideShell>
        ),
      },
      {
        title: "GASOK Goals",
        node: (
          <SlideShell>
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
              <div>
                <Label>GASOK goals</Label>
                <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
                  Turn JARYO into a real GIWA proof-of-receipt product.
                </h2>
              </div>
              <div className="grid gap-4">
                {milestones.map((milestone, index) => (
                  <div className="flex items-center gap-3" key={milestone}>
                    <div
                      className={[
                        "flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white",
                        index === milestones.length - 1
                          ? "bg-emerald-600"
                          : "bg-stone-950",
                      ].join(" ")}
                    >
                      {index + 1}
                    </div>
                    <p className="text-sm font-medium leading-6">{milestone}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-10 flex flex-col gap-3 border-t border-stone-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                  Contact
                </p>
                <p className="mt-1 text-sm font-medium">azerckid@gmail.com</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                  Demo
                </p>
                <p className="mt-1 text-sm font-medium">jaaryo.online</p>
              </div>
            </div>
          </SlideShell>
        ),
      },
    ],
    [],
  )

  const lastIndex = slides.length - 1
  const progress = ((current + 1) / slides.length) * 100

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault()
        setCurrent((value) => Math.min(value + 1, lastIndex))
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        setCurrent((value) => Math.max(value - 1, 0))
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [lastIndex])

  return (
    <main className="min-h-screen bg-stone-100 text-stone-950">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 rounded-lg border border-stone-200 bg-white px-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">JARYO GASOK Pitch Deck</p>
            <p className="mt-0.5 truncate text-xs text-stone-500">
              {current + 1}/{slides.length} · {slides[current].title}
            </p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            {slides.map((slide, index) => (
              <button
                aria-label={`Go to slide ${index + 1}: ${slide.title}`}
                className={[
                  "h-2.5 rounded-full transition-all",
                  index === current
                    ? "w-8 bg-stone-950"
                    : "w-2.5 bg-stone-300 hover:bg-stone-500",
                ].join(" ")}
                key={slide.title}
                onClick={() => setCurrent(index)}
                type="button"
              />
            ))}
          </div>
        </header>

        <div className="h-1 shrink-0 overflow-hidden rounded-full bg-stone-200">
          <div
            className="h-full rounded-full bg-stone-950 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="min-h-0 flex-1">{slides[current].node}</div>

        <footer className="flex h-14 shrink-0 items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3">
          <button
            aria-label="Previous slide"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-300 px-3 text-sm font-medium disabled:opacity-40"
            disabled={current === 0}
            onClick={() => setCurrent((value) => Math.max(value - 1, 0))}
            type="button"
          >
            <ArrowLeft className="size-4" />
            Previous
          </button>
          <p className="hidden text-xs text-stone-500 sm:block">
            Use arrow keys or the buttons to navigate
          </p>
          <button
            aria-label="Next slide"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-stone-950 px-3 text-sm font-medium text-white disabled:opacity-40"
            disabled={current === lastIndex}
            onClick={() => setCurrent((value) => Math.min(value + 1, lastIndex))}
            type="button"
          >
            Next
            <ArrowRight className="size-4" />
          </button>
        </footer>
      </div>
    </main>
  )
}
