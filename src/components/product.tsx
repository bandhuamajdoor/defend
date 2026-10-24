"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shell } from "@/components/shell";
import { Home } from "@/components/screens/home";
import { Projects } from "@/components/screens/projects";
import { NewProject } from "@/components/screens/new-project";
import { Project } from "@/components/screens/project";
import { Interview } from "@/components/screens/practice-room";
import { Report } from "@/components/screens/report";
import { Privacy } from "@/components/screens/privacy";
import { Settings } from "@/components/screens/settings";

export function Product() {
  const path = usePathname();
  let content: React.ReactNode;
  if (path === "/") content = <Home />;
  else if (path === "/projects") content = <Projects />;
  else if (path === "/projects/new") content = <NewProject />;
  else if (/^\/projects\/[^/]+$/.test(path))
    content = <Project key={path} id={path.split("/")[2]} />;
  else if (/^\/sessions\/[^/]+\/report$/.test(path))
    content = <Report key={path} id={path.split("/")[2]} />;
  else if (/^\/sessions\/[^/]+$/.test(path))
    content = <Interview key={path} id={path.split("/")[2]} />;
  else if (path === "/privacy") content = <Privacy />;
  else if (path === "/settings") content = <Settings />;
  else
    content = (
      <div className="empty-state">
        <h1>This page isn’t here.</h1>
        <Link href="/">Back to your workspace</Link>
      </div>
    );
  return <Shell>{content}</Shell>;
}
