import type { TemplateRecord } from "../lib/types";

type TemplateGridProps = {
  templates: TemplateRecord[];
};

export function TemplateGrid({ templates }: TemplateGridProps) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {templates.map((template) => (
        <article
          key={template.id}
          className="rounded-3xl border border-white/15 bg-gradient-to-br from-white/10 to-white/0 p-4 transition hover:-translate-y-1"
        >
          <div className="mb-4 h-48 rounded-2xl border border-white/10 bg-panel/80 p-4">
            <div className="h-full w-full rounded-xl bg-gradient-to-br from-white/25 via-white/10 to-transparent" />
          </div>
          <h3 className="font-semibold">{template.name}</h3>
          <p className="mt-2 text-sm text-white/65">{template.description}</p>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-mint">{template.slug}</p>
        </article>
      ))}
    </section>
  );
}
