"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  FolderOpen,
  Home as HomeIcon,
  Layers,
  Leaf,
  LockKeyhole,
  Menu,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { Badge, Icon } from "@/components/ui";
import { ThemeSwitch } from "./theme";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false),
    [current, setCurrent] = useState<string | null>(null),
    [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    setCurrent(sessionStorage.getItem("defend-current-session"));
  }, [pathname]);
  const nav = [
    { href: "/", label: "Overview", icon: HomeIcon, active: pathname === "/" },
    {
      href: "/projects",
      label: "My projects",
      icon: FolderOpen,
      active: pathname.startsWith("/projects"),
    },
    {
      href: current ? `/sessions/${current}` : "/projects",
      label: "Practice room",
      icon: MessageSquare,
      active: pathname.startsWith("/sessions"),
    },
  ];
  const title =
    pathname === "/privacy"
      ? "Privacy & data"
      : pathname.includes("/report")
        ? "Your debrief"
        : pathname.startsWith("/sessions")
          ? "Practice room"
          : pathname === "/projects/new"
            ? "New project"
            : pathname.startsWith("/projects")
              ? "My projects"
              : "Overview";
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link href="/" className="brand" aria-label="Defend home">
          <span className="brand-mark">
            <Layers size={21} strokeWidth={2} />
          </span>
          defend<span className="brand-period">.</span>
        </Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              onClick={() => setMenu(false)}
              className={`nav-item ${n.active ? "active" : ""}`}
            >
              <Icon icon={n.icon} />
              {n.label}
              {n.active && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-card">
          <span className="small-icon">
            <Leaf size={18} />
          </span>
          <h3>Progress takes practice.</h3>
          <p>A thoughtful answer starts with a little space to think.</p>
          <Link href="/projects/new">
            Start something <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          <Link
            className={`nav-item ${pathname === "/privacy" ? "active" : ""}`}
            href="/privacy"
          >
            <ShieldCheck size={18} />
            Privacy & data
          </Link>
          <div className="guest-profile">
            <span className="guest-avatar">Y</span>
            <div>
              <strong>Your workspace</strong>
              <small>Private browser session</small>
            </div>
            <LockKeyhole size={14} />
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-button"
              disabled={!ready}
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <ThemeSwitch />
            <Badge tone="green">Development preview</Badge>
            <span className="topbar-divider" />
            <span className="tiny-avatar">Y</span>
          </div>
        </header>
        <main
          id="main"
          className={`main ${pathname.startsWith("/sessions") && !pathname.includes("/report") ? "interview-main" : ""}`}
        >
          <div key={pathname} className="page-transition">
            {children}
          </div>
        </main>
        <footer className="footer">
          <span>Made for the work you put in.</span>
          <span>
            <LockKeyhole size={12} /> Private to this browser{" "}
            <span className="footer-dot">·</span> Mock AI mode
          </span>
        </footer>
      </div>
    </div>
  );
}
