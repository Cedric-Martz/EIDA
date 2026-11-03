# Framework Laptop 13 reference demo assets

These files are bundled so the EIDA reference demo remains deterministic.
EIDA is not affiliated with or endorsed by Framework Computer or the
photographers.

## Photographs

- `internal-components.jpg` — “Framework Laptop 13 - 2023 AMD Ryzen -
  Internal motherboard and component view”, Ogidya, CC BY 4.0. The local file
  is an unchanged copy of the 2869 × 2160 Wikimedia Commons file.
  Source: https://commons.wikimedia.org/wiki/File:Framework_Laptop_13_-_2023_AMD_Ryzen_-_Internal_motherboard_and_component_view.jpg
- `diy-setup.jpg` — “Framework laptop AMD 13 DIY setup”, Tyler Cipriani
  (Thcipriani), CC BY-SA 4.0. The local file is a Wikimedia-generated
  1280-pixel derivative of the original photograph.
  Source: https://commons.wikimedia.org/wiki/File:Framework_laptop_AMD_13_DIY_setup.jpg
- `device-overview.jpg` — “Framework laptop AMD 13”, Tyler Cipriani
  (Thcipriani), CC BY-SA 4.0. The local file is a Wikimedia-generated
  1280-pixel derivative of the original photograph.
  Source: https://commons.wikimedia.org/wiki/File:Framework_laptop_AMD_13.jpg

CC BY 4.0: https://creativecommons.org/licenses/by/4.0/

CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/

## CAD

- `framework-battery.step` — Framework Laptop 13 battery CAD, Framework
  Computer Inc., CC BY 4.0. SHA-256:
  `1c8ae3b3026c64a1473c2c2662f0746a3734c47cd318c80a08695ccbb065f1c9`.
  Source: https://github.com/FrameworkComputer/Framework-Laptop-13/blob/main/Battery/FWKNAQ9_G01_20210911.stp
- The Framework display STEP is used as a remote dimensional source but is not
  bundled because its raw tessellation was not visually useful in the demo.
  Source: https://github.com/FrameworkComputer/Framework-Laptop-13/blob/main/Display/135_fhd_hads_asm.stp
- `framework-hinge-left.glb` and `framework-hinge-right.glb` are locally
  triangulated derivatives of Framework's official hinge STEP assemblies. The
  source STEP files remain available from:
  https://github.com/FrameworkComputer/Framework-Laptop-13/tree/main/Hinges

The bundled `.glb` files are locally triangulated and axis-normalized
derivatives produced with OpenCascade through `occt-import-js`; no geometric
features were invented during conversion. Their SHA-256 checksums, together
with the source STEP checksums, are recorded in
`src/domain/reconstruction/demo-assets.ts`. Parametric details used for parts
without published 3D CAD remain explicitly marked as estimated in the viewer.
