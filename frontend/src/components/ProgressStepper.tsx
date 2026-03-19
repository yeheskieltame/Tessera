"use client";

import { AnalyzeStep } from "@/lib/api";

interface ProgressStepperProps {
  steps: AnalyzeStep[];
}

const stepNames = [
  "Fetching project data",
  "Building trust graph",
  "Running mechanism simulation",
  "AI qualitative analysis",
  "Generating composite score",
  "Creating report",
];

export default function ProgressStepper({ steps }: ProgressStepperProps) {
  const displaySteps: AnalyzeStep[] =
    steps.length > 0
      ? steps
      : stepNames.map((name, i) => ({
          step: i + 1,
          name,
          status: "pending" as const,
        }));

  const completedCount = displaySteps.filter((s) => s.status === "done").length;
  const progress = (completedCount / displaySteps.length) * 100;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {displaySteps.map((step) => (
          <div
            key={step.step}
            className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors"
          >
            {/* Status icon */}
            <div className="flex-shrink-0">
              {step.status === "done" && (
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {step.status === "running" && (
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                </div>
              )}
              {step.status === "pending" && (
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                  <span className="text-xs font-medium text-slate-400">
                    {step.step}
                  </span>
                </div>
              )}
              {step.status === "error" && (
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
            </div>

            {/* Label */}
            <span
              className={`text-sm ${
                step.status === "done"
                  ? "text-slate-700 font-medium"
                  : step.status === "running"
                    ? "text-blue-700 font-semibold"
                    : step.status === "error"
                      ? "text-red-600 font-medium"
                      : "text-slate-400"
              }`}
            >
              {step.name}
            </span>

            {/* Error message */}
            {step.error && (
              <span className="text-xs text-red-400 ml-auto">{step.error}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
