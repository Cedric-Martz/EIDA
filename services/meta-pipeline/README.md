# EIDA Meta reconstruction pipeline

This directory defines an optional future GPU-service boundary. It is not used
by the current local reconstruction workflow or the GitHub Pages showcase. It
is deliberately a contract, not a fake inference server: real output requires
the official model checkpoints, their accepted licences and compatible NVIDIA
compute.

## Model roles

1. **Llama 4 or Muse** reads the approved source snapshot and photographs and
   emits a cited, conservative part inventory.
2. **SAM 3.1** produces masks and stable object identities across views.
3. **DINOv3** computes dense cross-view feature correspondences.
4. **SAM 3D Objects** reconstructs one textured mesh per accepted part mask.
5. **Llama 4 or Muse** proposes the part hierarchy, transforms and mates from
   the evidence and geometric outputs.
6. **EIDA** validates scale, bounds and overlaps and returns an assembly
   manifest whose asset entries point to CORS-enabled GLB files.

The official SAM 3D Objects setup currently targets Linux with an NVIDIA GPU
and documents 32 GB of VRAM. Treat that as the deployment baseline, then
measure the exact workload before choosing a hosted GPU.

## HTTP contract

The full schema is in [`openapi.yaml`](./openapi.yaml).

- `GET /health` reports the models actually loaded by the worker.
- `POST /v1/reconstructions` accepts multipart form data containing one JSON
  `request` and repeated `photos` fields. It returns a queued or running job.
- `GET /v1/reconstructions/{jobId}` returns the latest stage progress,
  artifacts and, on success, an EIDA assembly manifest.

For a future deployed frontend, set:

```text
NEXT_PUBLIC_EIDA_META_PIPELINE_API=https://gpu.example.com
```

The current workflow does not start this service. Remote HTTP endpoints are
intentionally rejected.

## Output requirements

- GLB/GLTF assets use a documented `millimetresPerAssetUnit` conversion.
- Each reconstructed part has an evidence-backed fidelity level.
- Asset URLs support CORS for the GitHub Pages origin and remain valid long
  enough for project restoration; stable object URLs are preferable to short
  signed links.
- The service must never report an estimated mesh as `measured` or `exact`.
- Provider keys and checkpoint tokens stay on the GPU worker, never in the
  static bundle.
- Production deployments should authenticate requests, limit upload size,
  validate image signatures, isolate jobs and delete raw photos according to a
  published retention policy.

## Implementation order

Start with the health endpoint and an authenticated job queue. Integrate SAM
3.1 masks first, then DINOv3 correspondences, SAM 3D Objects export, and finally
manifest assembly and validation. Store each intermediate artifact so the UI
can show what every model contributed and failures can be resumed rather than
restarting the whole job.
