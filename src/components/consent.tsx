"use client";
import Link from "next/link";
import { useRuntime } from "./runtime";

export function Consent({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const runtime = useRuntime();
  return (
    <label className="consent">
      <input
        type="checkbox"
        checked={checked}
        disabled={!runtime?.ready}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        I agree to store my selected files and answers in this browser
        workspace. {runtime?.dataDisclosure ?? "Loading coach configuration…"}{" "}
        <Link href="/privacy">Privacy details</Link>
      </span>
    </label>
  );
}
