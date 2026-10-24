"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  ExternalLink,
  HardDrive,
  KeyRound,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useRuntime } from "@/components/runtime";
import { Badge } from "@/components/ui";
const groq = `MODEL_PROVIDER=groq\nMODEL_NAME=openai/gpt-oss-20b\nGROQ_API_KEY=your_free_account_key\nMODEL_FREE_TIER_ONLY=true\nMODEL_DAILY_REQUEST_LIMIT=120\nMODEL_SESSION_REQUEST_LIMIT=24`;
const ollama = `MODEL_PROVIDER=ollama\nMODEL_BASE_URL=http://127.0.0.1:11434\nMODEL_NAME=your_installed_local_model\nMODEL_DAILY_REQUEST_LIMIT=120\nMODEL_SESSION_REQUEST_LIMIT=24`;
export function Settings() {
  const runtime = useRuntime(),
    [copied, setCopied] = useState("");
  async function copy(name: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(name);
  }
  return (
    <>
      <Link className="back-link" href="/">
        ← Your workspace
      </Link>
      <div className="page-heading">
        <div className="eyebrow">A COACH YOU CAN AFFORD TO PRACTISE WITH</div>
        <h1>
          Connect free AI<span className="green-period">.</span>
        </h1>
        <p>Use a hosted free plan or run a model on your own computer.</p>
      </div>
      <section className="coach-setup-banner">
        <ShieldCheck size={23} />
        <p>
          <strong>Current mode: {runtime?.label ?? "loading"}</strong>
          <br />
          {runtime?.dataDisclosure ?? "Reading the coach configuration…"}
        </p>
        <Badge tone={runtime?.ready ? "green" : "neutral"}>
          {runtime?.ready ? "Configured" : "Needs setup"}
        </Badge>
      </section>
      <div className="setup-grid">
        <section className="panel setup-card">
          <span className="step-icon">
            <Zap size={22} />
          </span>
          <Badge tone="green">Fastest way to try</Badge>
          <h2>Groq Free</h2>
          <p>
            Create a free Groq account and API key, then configure this local
            build. Keep the account on its Free plan. Provider limits can pause
            generation; Defend never upgrades your account or falls back to a
            paid service.
          </p>
          <a
            className="btn primary"
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
          >
            Get a free Groq key <ExternalLink size={15} />
          </a>
          <ol>
            <li>
              Put your key in the gitignored <code>.env.local</code> on this
              computer.
            </li>
            <li>Add the settings below, replacing the placeholder.</li>
            <li>
              Restart the web process and worker, then prepare a fresh project
              so the provider disclosure and plan match.
            </li>
          </ol>
          <pre className="setup-code">{groq}</pre>
          <button
            className="btn secondary"
            onClick={() => void copy("groq", groq)}
          >
            {copied === "groq" ? <Check size={15} /> : <Copy size={15} />}{" "}
            {copied === "groq" ? "Copied" : "Copy configuration"}
          </button>
          <p className="small-copy">
            The selected source excerpts and answers leave this computer when
            you use Groq. Review its policies and upload only code you are
            allowed to share.
          </p>
        </section>
        <section className="panel setup-card">
          <span className="step-icon">
            <HardDrive size={22} />
          </span>
          <Badge>Local and private</Badge>
          <h2>Ollama</h2>
          <p>
            Install Ollama and a local model you can run comfortably. No
            per-request API charge. Smaller models can be slower or less
            reliable; evaluate their coaching with your own project before
            relying on it.
          </p>
          <a
            className="btn secondary"
            href="https://ollama.com/download/windows"
            target="_blank"
            rel="noreferrer"
          >
            Get Ollama for Windows <ExternalLink size={15} />
          </a>
          <ol>
            <li>
              Install Ollama and download a model appropriate for your machine.
            </li>
            <li>
              Set the model name below to a model shown by{" "}
              <code>ollama list</code>.
            </li>
            <li>
              Restart web and worker. Only a loopback server and local models
              are allowed; cloud models are disabled.
            </li>
          </ol>
          <pre className="setup-code">{ollama}</pre>
          <button
            className="btn secondary"
            onClick={() => void copy("ollama", ollama)}
          >
            {copied === "ollama" ? <Check size={15} /> : <Copy size={15} />}{" "}
            {copied === "ollama" ? "Copied" : "Copy configuration"}
          </button>
          <p className="small-copy">
            An 8k context window is used initially. A larger codebase is indexed
            and retrieved in smaller packs rather than being sent in one
            request.
          </p>
        </section>
      </div>
      <div className="notice">
        <KeyRound size={16} /> Keep real keys out of chat, screenshots, source
        control and browser storage. This page only copies placeholders; it
        never collects or stores your key.
      </div>
    </>
  );
}
