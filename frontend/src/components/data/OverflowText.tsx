import { useEffect, useRef, useState } from "react";

type OverflowTextProps = { value: string; copyable?: boolean; label?: string };
type Feedback = { id: number; message: string };

export function OverflowText({ value, copyable = false, label }: OverflowTextProps) {
  const [feedback, setFeedback] = useState<Feedback>({ id: 0, message: "" });
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function copy() {
    const currentRequest = ++requestId.current;
    let message: string;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(value);
      message = "Đã sao chép";
    } catch {
      message = "Không thể sao chép";
    }
    if (mounted.current && currentRequest === requestId.current) {
      setFeedback({ id: currentRequest, message });
    }
  }

  return (
    <span className="overflow-text" title={value}>
      <span className="overflow-text__value">{value}</span>
      {copyable && <button className="overflow-text__copy" type="button" aria-label={`Sao chép ${label ?? "giá trị"}`} onClick={() => void copy()}>Sao chép</button>}
      <span key={feedback.id} className="sr-only" role="status" aria-live="polite">{feedback.message}</span>
    </span>
  );
}
