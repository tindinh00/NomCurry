"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/app/lib/nomcurry/api";
import { getErrorMessage } from "@/app/lib/nomcurry/format";
import { normalizeRoute } from "@/app/lib/nomcurry/selectors";
import type { AppRoute, AppState } from "@/app/types/nomcurry";

/**
 * Owns the app-level API lifecycle so screens stay UI-focused.
 */
export function useNomCurryApp() {
  const [state, setState] = useState<AppState | null>(null);
  const [route, setRoute] = useState<AppRoute>("dashboard");
  const [loading, setLoading] = useState(true);
  const [busyMessage, setBusyMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await api<AppState>("/api/initial-data");
      setState(data);
      setRoute((current) => normalizeRoute(current, data));
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  async function mutate(url: string, payload: Record<string, unknown>, success: string) {
    setBusyMessage(success);
    setError("");

    const toastId = toast.loading("Đang xử lý...");
    try {
      const data = await api<AppState>(url, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setState(data);
      setRoute((current) => normalizeRoute(current, data));
      toast.success(success, { id: toastId });
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(message, { id: toastId });
    } finally {
      setBusyMessage("");
    }
  }

  function navigate(nextRoute: AppRoute) {
    if (!state) return;
    setRoute(normalizeRoute(nextRoute, state));
  }

  return {
    state,
    route,
    loading,
    busyMessage,
    error,
    load,
    mutate,
    navigate,
  };
}

