"use client";

interface StatusCardProps {
  title: string;
  value: string;
  status?: "online" | "offline" | "neutral";
  subtitle?: string;
}

export default function StatusCard({
  title,
  value,
  status = "neutral",
  subtitle,
}: StatusCardProps) {
  const dot =
    status === "online"
      ? "bg-emerald-400"
      : status === "offline"
        ? "bg-red-400"
        : "bg-blue-400";

  return (
    <div className="glass-strong rounded-2xl p-5 shadow-lg shadow-blue-100/50">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2.5 h-2.5 rounded-full ${dot} animate-pulse`} />
        <span className="text-sm font-medium text-slate-500">{title}</span>
      </div>
      <p className="text-xl font-bold text-slate-800">{value}</p>
      {subtitle && (
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
