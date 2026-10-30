import { GithubShowcase } from "@/features/showcase/github-showcase";
import { EidaWorkspace } from "@/features/workspace/eida-workspace";

export default function Home() {
  if (process.env.NEXT_PUBLIC_STATIC_SHOWCASE === "true") {
    return <GithubShowcase />;
  }
  return <EidaWorkspace />;
}
