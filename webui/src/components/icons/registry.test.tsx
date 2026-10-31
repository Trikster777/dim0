// The speak button needs a speaker glyph that lives in the shared icon
// registry (registry.ts → index.ts), not only inside the lazily loaded
// icon picker. The stop glyph of the playing state comes from the same place.

import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { SpeakerHighIcon, StopIcon } from "@/components/icons"


describe("shared icon registry", () => {
  it("exposes the speaker icon as a component", () => {
    const { container } = render(<SpeakerHighIcon className="size-4" />)
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("exposes the stop icon as a component", () => {
    const { container } = render(<StopIcon className="size-4" />)
    expect(container.querySelector("svg")).not.toBeNull()
  })
})
