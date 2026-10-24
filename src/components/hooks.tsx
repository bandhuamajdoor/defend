"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { request } from "@/components/client";

export function useResource<T>(
  path: string,
  poll?: (value: T | null) => boolean,
) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  const latest = useRef(data);
  latest.current = data;
  const polling = useRef(poll);
  polling.current = poll;
  const refresh = useCallback(async () => {
    try {
      const value = await request<T>(path);
      setData(value);
      setError("");
      return value;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, [path]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let started = Date.now();
    const read = async () => {
      try {
        const value = await request<T>(path);
        if (active) {
          setData(value);
          setError("");
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    };
    const tick = async () => {
      if (!active) return;
      if (
        !document.hidden &&
        navigator.onLine &&
        polling.current?.(latest.current)
      ) {
        await read();
      }
      timer = setTimeout(tick, Date.now() - started < 10000 ? 1000 : 3000);
    };
    setData(null);
    void read();
    timer = setTimeout(tick, 1000);
    const restore = () => {
      if (!document.hidden && navigator.onLine) {
        started = Date.now();
        void read();
      }
    };
    document.addEventListener("visibilitychange", restore);
    window.addEventListener("online", restore);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", restore);
      window.removeEventListener("online", restore);
    };
  }, [path]);
  return { data, error, refresh };
}

export function useMutation() {
  const pending = useRef<{ signature: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run<T>(
    path: string,
    method: string,
    body: unknown,
  ): Promise<T | null> {
    if (busy) return null;
    setBusy(true);
    setError("");
    const signature = JSON.stringify([path, method, body]);
    if (pending.current?.signature !== signature)
      pending.current = { signature, key: crypto.randomUUID() };
    try {
      const value = await request<T>(path, method, body, pending.current.key);
      pending.current = null;
      return value;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, error, setError };
}
