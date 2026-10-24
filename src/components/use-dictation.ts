"use client";
import { useEffect, useRef, useState } from "react";
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult:
    | ((e: {
        resultIndex: number;
        results: {
          length: number;
          [index: number]: {
            isFinal: boolean;
            [index: number]: { transcript: string };
          };
        };
      }) => void)
    | null;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function useDictation(onText: (text: string) => void) {
  const [available, setAvailable] = useState(false),
    [listening, setListening] = useState(false),
    [interim, setInterim] = useState(""),
    [error, setError] = useState("");
  const ref = useRef<Recognition | null>(null),
    callback = useRef(onText);
  callback.current = onText;
  useEffect(() => {
    const api =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition;
    setAvailable(!!api);
    return () => {
      if (ref.current) {
        ref.current.onend = null;
        ref.current.onresult = null;
        ref.current.abort();
      }
    };
  }, []);
  function stop() {
    ref.current?.stop();
    setInterim("");
  }
  function toggle() {
    if (listening) {
      stop();
      return;
    }
    setError("");
    const Api =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Api) return;
    const recognition = new Api();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      setInterim("");
    };
    recognition.onerror = (e) => {
      setError(
        e.error === "not-allowed"
          ? "Microphone permission was declined. You can type or use an external dictation tool."
          : "Browser dictation stopped. Your transcript is still editable.",
      );
      setListening(false);
      setInterim("");
    };
    recognition.onresult = (e) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) callback.current(e.results[i][0].transcript);
        else partial += e.results[i][0].transcript;
      }
      setInterim(partial);
    };
    ref.current = recognition;
    try {
      recognition.start();
    } catch {
      setError("This browser could not start dictation. You can still type.");
    }
  }
  return { available, listening, interim, error, toggle, stop };
}
