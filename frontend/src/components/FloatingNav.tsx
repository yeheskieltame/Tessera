"use client";

import { useEffect, useState } from "react";

const sections = [
  { id: "status", label: "Status" },
  { id: "analyze", label: "Analyze" },
  { id: "trust", label: "Trust" },
  { id: "simulate", label: "Simulate" },
  { id: "project", label: "Project" },
  { id: "reports", label: "Reports" },
];

export default function FloatingNav() {
  const [active, setActive] = useState("status");

  useEffect(() => {
    const handleScroll = () => {
      const offsets = sections.map((s) => {
        const el = document.getElementById(s.id);
        return { id: s.id, top: el ? el.getBoundingClientRect().top : Infinity };
      });
      const current = offsets.reduce((closest, item) =>
        Math.abs(item.top - 100) < Math.abs(closest.top - 100) ? item : closest
      );
      setActive(current.id);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="glass rounded-full px-2 py-2 flex items-center gap-1 shadow-lg shadow-blue-200/40">
        <a
          href="/"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-gradient mr-1"
        >
          <img src="/tessera-icon-64.png" alt="Tessera" className="w-5 h-5" />
          Tessera
        </a>
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              active === s.id
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 hover:text-blue-600 hover:bg-blue-50/50"
            }`}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
