"use client";

import { useState } from "react";
import { Overview } from "./Overview";
import { Questions } from "./Questions";
import { Reports } from "./Reports";
import { Generate } from "./Generate";
import { Games } from "./Games";
import { Users } from "./Users";

const TABS = [
  { id: "overview", label: "📊 Overview" },
  { id: "review", label: "🧐 Review queue" },
  { id: "questions", label: "🗂️ Questions" },
  { id: "reports", label: "🚩 Reports" },
  { id: "generate", label: "✨ Generate" },
  { id: "games", label: "🎮 Games" },
  { id: "users", label: "👥 Users" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function AdminDashboard({ role, username }: { role: "ADMIN" | "MODERATOR" | "USER"; username: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const isAdmin = role === "ADMIN";
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-3xl font-bold">Control room</h1>
          <p className="text-ink-300 text-sm">
            Signed in as <b>{username}</b> · {role.toLowerCase()}
            {!isAdmin && " · game settings and user roles are admin-only"}
          </p>
        </div>
      </header>
      <nav className="mb-6 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-xl px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition ${tab === t.id ? "bg-white/12 text-white" : "text-ink-300 hover:bg-white/5 hover:text-white"}`}>
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
