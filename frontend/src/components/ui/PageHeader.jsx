export default function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-2xl leading-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
