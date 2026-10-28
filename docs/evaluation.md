# Scientific evaluation protocol v1

## Research question

Does evidence-aware reconstruction reduce unsupported claims without simply suppressing all component predictions?

## Conditions

A: Photos only; B: Photos + approved documents; C: Photos + documents + evidence validation.

## Ground truth

Manually reviewed SM-T530 component inventory with photo and document citations. Distinguish **externally observable** and **internal/documented** parts. Add a second device when time permits.

## Primary measures

- Precision = true positive proposed components / all proposed components.
- Recall = true positive proposed components / all ground-truth components.
- Unsupported claim rate = unsupported claims / all claims.
- Coverage = ground-truth components with useful 3D representation / ground-truth components.
- Geometry quality: compare dimensions only where measured reference exists.

## Experimental safeguards

Use the same image sets and observation budget across conditions. Freeze prompts and model versions, log run identifiers and costs, avoid judging against model-generated ground truth. Report sample sizes and uncertainty; two devices do not establish broad generalization. No environmental savings estimate without measured lifecycle data.
