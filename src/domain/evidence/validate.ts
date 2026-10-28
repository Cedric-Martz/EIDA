import { projectSchema, type Project } from "./schema";
export function validateProject(input: unknown): Project {
  const project = projectSchema.parse(input);
  const ids = new Set(project.evidence.map((e) => e.id));
  if (ids.size !== project.evidence.length)
    throw new Error("Duplicate evidence IDs");
  const componentIds = new Set(project.components.map((c) => c.id));
  if (componentIds.size !== project.components.length)
    throw new Error("Duplicate component IDs");
  for (const component of project.components) {
    if (component.parentId && !componentIds.has(component.parentId))
      throw new Error(`Unknown parent ${component.parentId}`);
    for (const claim of component.claims) {
      if (claim.componentId !== component.id)
        throw new Error(`Claim owner mismatch: ${claim.id}`);
      if (claim.evidenceIds.some((id) => !ids.has(id)))
        throw new Error(`Unknown evidence on claim ${claim.id}`);
      if (
        claim.status === "documented" &&
        !claim.evidenceIds.some(
          (id) =>
            project.evidence.find((e) => e.id === id)?.kind === "document",
        )
      )
        throw new Error(`Documented claim lacks document: ${claim.id}`);
      if (
        claim.status === "observed" &&
        !claim.evidenceIds.some((id) =>
          ["photo", "measurement"].includes(
            project.evidence.find((e) => e.id === id)?.kind ?? "",
          ),
        )
      )
        throw new Error(`Observed claim lacks observation: ${claim.id}`);
    }
  }
  return project;
}
