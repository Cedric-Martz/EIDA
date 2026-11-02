import { reconstructionGraphSchema, type ReconstructionGraph } from "./schema";

export type ReconstructionGraphIssue = {
  path: string;
  message: string;
};

export class ReconstructionGraphValidationError extends Error {
  constructor(readonly issues: readonly ReconstructionGraphIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "ReconstructionGraphValidationError";
  }
}

function duplicates(values: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return repeated;
}

export function validateReconstructionGraph(
  input: unknown,
): ReconstructionGraph {
  const graph = reconstructionGraphSchema.parse(input);
  const issues: ReconstructionGraphIssue[] = [];
  const evidenceIds = new Set(graph.evidence.map((item) => item.id));
  const partIds = new Set(graph.parts.map((part) => part.id));

  for (const id of duplicates(graph.evidence.map((item) => item.id))) {
    issues.push({
      path: "evidence",
      message: `Duplicate evidence ID \"${id}\"`,
    });
  }
  for (const id of duplicates(graph.parts.map((part) => part.id))) {
    issues.push({ path: "parts", message: `Duplicate part ID \"${id}\"` });
  }
  for (const id of duplicates(graph.relations.map((relation) => relation.id))) {
    issues.push({
      path: "relations",
      message: `Duplicate relation ID \"${id}\"`,
    });
  }

  graph.parts.forEach((part, index) => {
    if (part.parentId && !partIds.has(part.parentId)) {
      issues.push({
        path: `parts.${index}.parentId`,
        message: `Unknown parent part \"${part.parentId}\"`,
      });
    }
    const linkedEvidence = Object.values(part.evidence).flat();
    linkedEvidence.forEach((id) => {
      if (!evidenceIds.has(id)) {
        issues.push({
          path: `parts.${index}.evidence`,
          message: `Unknown evidence ID \"${id}\"`,
        });
      }
    });
    if (
      part.geometry.kind === "primitive" &&
      part.geometry.primitive === "rounded_box" &&
      part.geometry.cornerRadiusMm === undefined
    ) {
      issues.push({
        path: `parts.${index}.geometry.cornerRadiusMm`,
        message: "A rounded box requires a corner radius",
      });
    }
  });

  graph.evidence.forEach((evidence, index) => {
    if (evidence.sourceId && !evidenceIds.has(evidence.sourceId)) {
      issues.push({
        path: `evidence.${index}.sourceId`,
        message: `Unknown source evidence ID \"${evidence.sourceId}\"`,
      });
    }
  });

  graph.relations.forEach((relation, index) => {
    if (!partIds.has(relation.sourcePartId)) {
      issues.push({
        path: `relations.${index}.sourcePartId`,
        message: `Unknown source part \"${relation.sourcePartId}\"`,
      });
    }
    if (!partIds.has(relation.targetPartId)) {
      issues.push({
        path: `relations.${index}.targetPartId`,
        message: `Unknown target part \"${relation.targetPartId}\"`,
      });
    }
    relation.evidenceIds.forEach((id) => {
      if (!evidenceIds.has(id)) {
        issues.push({
          path: `relations.${index}.evidenceIds`,
          message: `Unknown evidence ID \"${id}\"`,
        });
      }
    });
  });

  if (issues.length > 0) throw new ReconstructionGraphValidationError(issues);
  return graph;
}
