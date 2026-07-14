import { useState } from "react";

type OverflowTextProps = { value: string; copyable?: boolean; label?: string };

export function OverflowText({ value, copyable = false, label }: OverflowTextProps) {
  const [feedback, setFeedback] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback("Đã sao chép");
    } catch {
      setFeedback("Không thể sao chép");
    }
  }

  return (
    <span className="overflow-text" title={value}>
      <span className="overflow-text__value">{value}</span>
      {copyable && <button className="overflow-text__copy" type="button" aria-label={`Sao chép ${label ?? "giá trị"}`} onClick={() => void copy()}>Sao chép</button>}
      <span className="sr-only" role="status" aria-live="polite">{feedback}</span>
    </span>
  );
}
