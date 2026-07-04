import "./dashboard.tokens.css";

const metrics = [
  { label: "Pipeline", value: "$2.4M", delta: "+18%", tone: "positive" },
  { label: "Activation", value: "68%", delta: "+7 pts", tone: "positive" },
  { label: "Open risk", value: "12", delta: "-4", tone: "warning" },
];

export function DashboardPage() {
  return (
    <main className="min-h-screen bg-[var(--dashboard-bg)] text-[var(--dashboard-text)]">
      <section className="mx-auto grid max-w-7xl grid-cols-[248px_1fr] gap-6 px-6 py-6">
        <aside className="rounded-[var(--dashboard-radius)] border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-4">
          <p className="text-sm font-semibold">Northstar</p>
          <nav className="mt-6 grid gap-2 text-sm text-[var(--dashboard-muted)]">
            <a className="rounded-md bg-blue-50 px-3 py-2 text-[var(--dashboard-accent)]">Overview</a>
            <a className="px-3 py-2">Customers</a>
            <a className="px-3 py-2">Signals</a>
            <a className="px-3 py-2">Reports</a>
          </nav>
        </aside>
        <div className="space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--dashboard-muted)]">Product dashboard</p>
              <h1 className="text-3xl font-semibold">Growth operating room</h1>
            </div>
            <button className="rounded-md bg-[var(--dashboard-accent)] px-4 py-2 text-sm font-medium text-white">Share brief</button>
          </header>
          <section className="grid grid-cols-3 gap-4">
            {metrics.map((metric) => (
              <article key={metric.label} className="rounded-[var(--dashboard-radius)] border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-5 shadow-[var(--dashboard-shadow)]">
                <p className="text-sm text-[var(--dashboard-muted)]">{metric.label}</p>
                <div className="mt-3 flex items-end justify-between">
                  <strong className="text-3xl">{metric.value}</strong>
                  <span className={metric.tone === "positive" ? "text-[var(--dashboard-positive)]" : "text-[var(--dashboard-warning)]"}>{metric.delta}</span>
                </div>
              </article>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
