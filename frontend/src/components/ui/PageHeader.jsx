export default function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-2xl font-normal leading-tight tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-soft">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}
