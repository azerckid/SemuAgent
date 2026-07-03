import type { Metadata } from "next"

import { GasokPitchDeck } from "./_components/gasok-pitch-deck"

export const metadata: Metadata = {
  title: "GASOK Pitch Deck",
  description:
    "Private pitch deck for an earlier GIWA-based document workflow concept.",
  robots: { index: false, follow: false },
}

export default function GasokPitchPage() {
  return <GasokPitchDeck />
}
