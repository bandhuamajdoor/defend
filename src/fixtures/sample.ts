import type { Upload } from "../domain/types";
export const sample: Upload = {
  title: "Campus Tickets",
  brief:
    "A ticket booking app for college events. Students select quantities, see a total and reserve seats.",
  contribution:
    "I built the ticket quantity selector, pricing logic and booking endpoint.",
  consent: true,
  files: [
    {
      path: "README.md",
      text: "# Campus Tickets\nA small college event booking application.\nStudents choose ticket quantities and reserve seats.\nThe authentication integration is supplied by the host application, not this sample.\n",
    },
    {
      path: "src/pricing.ts",
      text: 'export function calculateTotal(quantity: number, unitPrice: number) {\n  if (!Number.isInteger(quantity) || quantity < 0) {\n    throw new Error("Quantity must be a non-negative integer");\n  }\n  return quantity * unitPrice;\n}\n',
    },
    {
      path: "src/TicketSelector.tsx",
      text: 'import { useState } from "react";\nimport { calculateTotal } from "./pricing";\n\nexport function TicketSelector({ unitPrice = 200 }) {\n  const [quantity, setQuantity] = useState(1);\n  const [total] = useState(() => calculateTotal(quantity, unitPrice));\n  return (\n    <section>\n      <input aria-label="Tickets" type="number" min="0"\n        value={quantity} onChange={e => setQuantity(Number(e.target.value))} />\n      <p>Total: {total}</p>\n    </section>\n  );\n}\n',
    },
    {
      path: "src/ownership.ts",
      text: 'export function assertOwner(actorId: string, bookingOwnerId: string) {\n  if (actorId !== bookingOwnerId) throw new Error("Forbidden");\n}\n',
    },
    {
      path: "src/booking.ts",
      text: 'import { assertOwner } from "./ownership";\nexport function cancelBooking(actorId: string, booking: {ownerId: string}) {\n  assertOwner(actorId, booking.ownerId);\n  return { status: "cancelled" };\n}\n// Request authentication is handled in middleware outside this fixture.\n',
    },
    {
      path: "tests/pricing.test.ts",
      text: 'import { expect, test } from "vitest";\nimport { calculateTotal } from "../src/pricing";\ntest("zero tickets has zero price", () => {\n  expect(calculateTotal(0, 200)).toBe(0);\n});\ntest("negative quantities are rejected", () => {\n  expect(() => calculateTotal(-1, 200)).toThrow();\n});\n',
    },
  ],
};
