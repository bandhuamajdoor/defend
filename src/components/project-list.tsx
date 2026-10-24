"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowRight, ArrowUpRight, FolderOpen, Plus } from "lucide-react";
import type { ProjectDTO } from "@/domain/types";
import { request, RequestError } from "@/components/client";
import { ErrorNotice } from "@/components/ui";

export function ProjectList({ compact = false }: { compact?: boolean }) {
  const [projects, setProjects] = useState<ProjectDTO[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    request<{ projects: ProjectDTO[] }>("/projects")
      .then((r) => setProjects(r.projects))
      .catch((e) => {
        if (!(e instanceof RequestError && e.status === 401))
          setError(e.message);
      });
  }, []);
  return (
    <section className="project-section">
      {compact && (
        <div className="section-heading">
          <h2>
            Your projects{" "}
            <span className="count-badge">
              {projects.length.toString().padStart(2, "0")}
            </span>
          </h2>
          <Link className="text-link" href="/projects">
            View all projects <ArrowUpRight size={15} />
          </Link>
        </div>
      )}
      {error && <ErrorNotice message={error} />}
      {projects.length ? (
        <div className="projects-grid">
          {projects.slice(0, compact ? 3 : 100).map((p) => (
            <Link
              className="project-tile"
              href={`/projects/${p.id}`}
              key={p.id}
            >
              <span className="project-icon">
                <FolderOpen size={23} />
              </span>
              <ArrowUpRight className="tile-arrow" size={18} />
              <h3>{p.title}</h3>
              <p>Private project workspace</p>
              <div className="project-tile-footer">
                <span>
                  Added{" "}
                  {new Date(p.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span>
                  Open project <ArrowRight size={13} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-project">
          <span className="empty-icon">
            <FolderOpen size={25} />
          </span>
          <div>
            <h3>Your next explanation starts here.</h3>
            <p>Add a project you’ve built, or explore the sample above.</p>
          </div>
          <Link href="/projects/new" className="btn secondary">
            Add your first project <Plus size={16} />
          </Link>
        </div>
      )}
    </section>
  );
}
