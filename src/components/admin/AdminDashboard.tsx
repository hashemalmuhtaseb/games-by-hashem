"use client";

import { useState } from "react";
import { Overview } from "./Overview";
import { Questions } from "./Questions";
import { Reports } from "./Reports";
import { Generate } from "./Generate";
import { Games } from "./Games";
import { Users } from "./Users";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "review", label: "Review queue" },
  { id: "questions", label: "Questions" },
  { id: "reports", label: "Reports" },
  { id: "generate", label: "Generate" },
  { id: "games", label: "Games" },
  { id: "users", label: "Users" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function AdminDashboard({ role, username }: { role: "ADMIN" | "MODERATOR" | "USER"; username: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const isAdmin = role === "ADMIN";
  return (
    <main className="mx-auto max-w-6xl px-5 pt-10 pb-24 sm:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="serif text-[44px] leading-none text-fg">Control room</h1>
          <p className="mt-3 text-sm text-fg-3">
            Signed in as <b>{username}</b> · {role.toLowerCase()}
            {!isAdmin && " · game settings and user roles are admin-only"}
          </p>
        </div>
      </header>
      <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-line pb-3">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? "bg-surface-3 text-fg" : "text-fg-3 hover:text-fg"}`}>
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "overview" && <Overview onOpen={(t) => setTab(t as Tab)} />}
      {tab === "review" && <Questions key="review" preset={{ status: "PENDING_REVIEW" }} reviewMode />}
      {tab === "questions" && <Questions key="all" preset={{}} />}
      {tab === "reports" && <Reports />}
      {tab === "generate" && <Generate onReview={() => setTab("review")} />}
      {tab === "games" && <Games canEdit={isAdmin} />}
      {tab === "users" && <Users canEdit={isAdmin} />}
    </main>
  );
}
