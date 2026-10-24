"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Check,
  Code2,
  FileCode2,
  Files,
  Layers,
  MessageSquare,
  Plus,
} from "lucide-react";
import type { Operation } from "@/domain/types";
import { ensureGuest } from "@/components/client";
import { ErrorNotice, Icon } from "@/components/ui";
import { useMutation } from "@/components/hooks";
import { Consent } from "@/components/consent";
import { ProjectList } from "@/components/project-list";

export function Home() {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const mutation = useMutation();
  async function start() {
    try {
      await ensureGuest();
      const op = await mutation.run<Operation>("/projects/sample", "POST", {
        consent: true,
      });
      if (op) router.push(`/projects/${op.resourceId}?job=${op.jobId}`);
    } catch (e) {
      mutation.setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">A LITTLE PREPARATION GOES A LONG WAY</div>
          <h1>
            Good work deserves
            <br />a <em>great explanation.</em>
          </h1>
          <p className="intro-copy">
            You built the project. Now get comfortable talking about it.
            <br className="desktop-break" /> Practise your reasoning, find the
            gaps, and walk in ready.
          </p>
        </div>
        <span className="intro-corner">
          <span className="orbit-icon">
            <AudioLines size={24} />
          </span>
          YOUR CODE. YOUR VOICE.
        </span>
      </div>
      <section className="hero-panel" aria-labelledby="hero-title">
        <div className="hero-content">
          <span className="pill">
            <span className="status-dot" /> A SPACE TO FIND YOUR WORDS
          </span>
          <h2 id="hero-title">
            From “it works” to
            <br />
            <span>“here’s why.”</span>
          </h2>
          <p>
            A thoughtful project interview, grounded in your code.
            <br />
            One question at a time. At your own pace.
          </p>
          <div className="hero-actions">
            <Link className="btn primary" href="/projects/new">
              <Plus size={17} />
              Use my project <ArrowRight size={17} />
            </Link>
            <button
              className="btn secondary"
              onClick={start}
              disabled={!consent || mutation.busy}
            >
              {mutation.busy ? "Opening sample…" : "Try a sample"}
              <ArrowUpRight size={16} />
            </button>
          </div>
          <Consent checked={consent} onChange={setConsent} />
          <div className="hero-meta">
            <span>
              <Check size={13} /> No sign-up
            </span>
            <span>
              <Check size={13} /> Type or dictate
            </span>
            <span>
              <Check size={13} /> 5–8 minute practice
            </span>
          </div>
        </div>
        <div
          className="preview-scene"
          aria-label="Preview of the interview workspace"
        >
          <div className="scene-grid" />
          <div className="float-label">
            <span className="small-icon">
              <Code2 size={15} />
            </span>
            Grounded in your actual code
          </div>
          <div className="interview-preview">
            <div className="preview-bar">
              <span className="mini-logo">
                <Layers size={14} />
              </span>
              <strong>The practice room</strong>
              <span className="preview-dots">
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="preview-body">
              <span className="preview-step">
                02 / 05 <span>IMPLEMENTATION</span>
              </span>
              <div className="preview-speaker">
                <span className="speaker-symbol">
                  <AudioLines size={18} />
                </span>
                <span>Let’s talk about your project</span>
              </div>
              <h3>What happens when a user changes the ticket quantity?</h3>
              <div className="preview-code">
                <div>
                  <FileCode2 size={12} /> TicketSelector.tsx <span>L5–6</span>
                </div>
                <code>
                  <span className="muted">05</span> <b>const</b> [quantity,
                  setQuantity] =<br />
                  <span className="muted">06</span> <b>useState</b>(1);
                </code>
              </div>
              <div className="preview-input">
                <span>Your reasoning goes here…</span>
                <span className="preview-send">
                  <ArrowRight size={14} />
                </span>
              </div>
            </div>
          </div>
          <div className="float-note">
            <span className="note-check">
              <Check size={14} />
            </span>
            More clarity. Less cramming.
          </div>
        </div>
      </section>
      {mutation.error && <ErrorNotice message={mutation.error} />}
      <section className="how-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">BUILT AROUND YOUR UNDERSTANDING</span>
            <h2>A practice, not a performance.</h2>
          </div>
          <span className="quiet-copy">
            No grades. No gotchas. Just a clearer next step.
          </span>
        </div>
        <div className="steps-grid">
          {[
            {
              n: "01",
              icon: Files,
              title: "Bring what you built",
              text: "Add your project files and tell us what you worked on. You confirm the context.",
            },
            {
              n: "02",
              icon: MessageSquare,
              title: "Think it through, out loud",
              text: "Explain your decisions one question at a time. Type, or use your favourite dictation tool.",
            },
            {
              n: "03",
              icon: BookOpen,
              title: "Leave with a direction",
              text: "Review your answers alongside the source. Pick one concept and try a fresh scenario.",
            },
          ].map((s) => (
            <article className="step-card" key={s.n}>
              <div className="step-top">
                <span className="step-icon">
                  <Icon icon={s.icon} size={20} />
                </span>
                <span>{s.n}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>
      <ProjectList compact />
    </>
  );
}
