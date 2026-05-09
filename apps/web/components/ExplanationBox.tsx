import { Sparkles } from "lucide-react";

export function ExplanationBox({
  text,
  whatThisDoes,
}: {
  text: string;
  whatThisDoes: string[];
}) {
  if (!text && whatThisDoes.length === 0) return null;
  return (
    <section className="panel p-5" aria-label="Plain-English summary">
      <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
        <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden />
        Plain-English summary
      </div>
      {text && (
        <p className="text-[14px] leading-[1.65] text-text-primary">{text}</p>
      )}
      {whatThisDoes.length > 0 && (
        <>
          <div className="mt-5 mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
            What this transaction does
          </div>
          <ul className="space-y-1.5 text-[13px] leading-[1.55] text-text-secondary">
            {whatThisDoes.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-text-muted">
                  ·
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
