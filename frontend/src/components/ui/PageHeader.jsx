export default function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-4xl leading-tight sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-xl text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
