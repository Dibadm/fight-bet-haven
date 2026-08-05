import { cn } from "@/lib/utils";

export function Panel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface p-4", className)}>
      <header className="mb-3">
        <h2 className="font-display text-xl leading-none tracking-wide">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

const control =
  "w-full rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-sm outline-none transition-colors focus:border-primary";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(control, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(control, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(control, "font-mono text-xs", props.className)} />;
}

export function Btn({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      {...props}
      className={cn(
        "rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "ghost" && "border border-border text-foreground hover:border-primary/60",
        variant === "danger" && "border border-destructive/60 text-destructive hover:bg-destructive/10",
        className,
      )}
    />
  );
}

export function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    muted: "bg-secondary text-muted-foreground",
    open: "bg-primary/15 text-primary",
    warn: "bg-gold/15 text-gold",
    bad: "bg-destructive/15 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tones[tone] ?? tones["muted"],
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string) {
  if (status === "open" || status === "active" || status === "published") return "open";
  if (status === "suspended" || status === "result_pending" || status === "pending") return "warn";
  if (status === "void" || status === "cancelled") return "bad";
  return "muted";
}
