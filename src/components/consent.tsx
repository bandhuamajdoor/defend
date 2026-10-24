"use client";
import Link from "next/link";

export function Consent({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="consent">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        I agree to store the selected files and my answers in this private
        browser workspace. This preview uses a local mock; no content is sent to
        an AI provider. <Link href="/privacy">Privacy details</Link>
      </span>
    </label>
  );
}
