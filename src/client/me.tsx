"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { PublicProfile } from "@/server/profiles";

interface MeState {
  me: PublicProfile | null;
  user: { username: string; role: string } | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<MeState>({ me: null, user: null, loading: true, refresh: async () => {} });

export function MeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ me: PublicProfile | null; user: MeState["user"] }>({ me: null, user: null });
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const r = await api<{ me: PublicProfile; user: MeState["user"] }>("/api/me");
      setState({ me: r.me, user: r.user });
    } catch {
      /* offline — keep last known */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return <Ctx.Provider value={{ ...state, loading, refresh }}>{children}</Ctx.Provider>;
}

export const useMe = () => useContext(Ctx);
