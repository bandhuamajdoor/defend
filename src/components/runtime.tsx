"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { request } from "./client";
export interface Capabilities {
  provider: "mock" | "groq" | "ollama";
  mode: "guided" | "live";
  label: string;
  model: string | null;
  consentVersion: string;
  dataDisclosure: string;
  ready: boolean;
  uploadLimits: {
    files: number;
    fileBytes: number;
    totalBytes: number;
    totalCharacters: number;
    requestBytes: number;
  };
}
const RuntimeContext = createContext<Capabilities | null>(null);
export function RuntimeProvider({ children }: { children: React.ReactNode }) {
  const [runtime, setRuntime] = useState<Capabilities | null>(null);
  useEffect(() => {
    request<Capabilities>("/capabilities")
      .then(setRuntime)
      .catch(() => {});
  }, []);
  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}
export const useRuntime = () => useContext(RuntimeContext);
