"use client";

import { useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export default function CodeBlock({ code, language = "bash" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-sm overflow-x-auto font-mono">
        <code data-language={language}>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
