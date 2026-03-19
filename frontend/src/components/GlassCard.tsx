"use client";

import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export default function GlassCard({
  children,
  className = "",
  hover = false,
}: GlassCardProps) {
  return (
    <div
      className={`
        glass-strong rounded-2xl shadow-lg shadow-blue-100/50 p-6
        ${hover ? "transition-all duration-300 hover:shadow-xl hover:shadow-blue-200/60 hover:-translate-y-1" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
