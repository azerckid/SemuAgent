import type { Metadata } from "next"

import { GasokPitchDeck } from "./_components/gasok-pitch-deck"

export const metadata: Metadata = {
  title: "JARYO | GASOK Pitch Deck",
  description:
    "AI document workflow SaaS for accounting firms with GIWA-based proof of receipt.",
}

export default function GasokPitchPage() {
  return <GasokPitchDeck />
}
