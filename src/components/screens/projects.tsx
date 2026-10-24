"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ProjectList } from "@/components/project-list";

export function Projects() {
  return (
    <>
      <div className="section-heading page-heading">
        <div>
          <div className="eyebrow">YOUR IDEAS, EXPLAINED BETTER</div>
          <h1>
            My projects<span className="green-period">.</span>
          </h1>
          <p>Your source, your context, your next practice.</p>
        </div>
        <Link className="btn primary" href="/projects/new">
          <Plus size={16} />
          Add project
        </Link>
      </div>
      <ProjectList />
    </>
  );
}
