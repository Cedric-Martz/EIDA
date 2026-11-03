const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const assetRoot = `${basePath}/demo/framework-laptop-13`;

export type DemoPhotoAsset = {
  evidenceId: string;
  src: string;
  sourceUrl: string;
  author: string;
  license: string;
  licenseUrl: string;
  alt: string;
};

export const demoReferenceAssets = {
  photos: [
    {
      evidenceId: "photo-internal-components",
      src: `${assetRoot}/internal-components.jpg`,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Framework_Laptop_13_-_2023_AMD_Ryzen_-_Internal_motherboard_and_component_view.jpg",
      author: "Ogidya",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      alt: "Open Framework Laptop 13 showing the battery, mainboard, fan and speakers",
    },
    {
      evidenceId: "photo-diy-setup",
      src: `${assetRoot}/diy-setup.jpg`,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Framework_laptop_AMD_13_DIY_setup.jpg",
      author: "Tyler Cipriani (Thcipriani)",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      alt: "Framework Laptop 13 DIY setup with the input cover removed",
    },
    {
      evidenceId: "photo-device-overview",
      src: `${assetRoot}/device-overview.jpg`,
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Framework_laptop_AMD_13.jpg",
      author: "Tyler Cipriani (Thcipriani)",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      alt: "Framework Laptop 13 exterior and expansion cards",
    },
  ] satisfies DemoPhotoAsset[],
  cad: {
    evidenceId: "cad-battery-step",
    downloadUrl: `${assetRoot}/framework-battery.step`,
    sourceUrl:
      "https://github.com/FrameworkComputer/Framework-Laptop-13/blob/main/Battery/FWKNAQ9_G01_20210911.stp",
    repositoryUrl: "https://github.com/FrameworkComputer/Framework-Laptop-13",
    label: "Framework Laptop 13 battery STEP",
    author: "Framework Computer Inc.",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    sha256: "1c8ae3b3026c64a1473c2c2662f0746a3734c47cd318c80a08695ccbb065f1c9",
    meshUrl: `${assetRoot}/framework-battery.glb`,
    meshSha256:
      "9328c08f1fd6f348003f731826b869515dbd26acaa92373d1910e88f07cf70d3",
  },
  displayCad: {
    evidenceId: "cad-display-step",
    sourceUrl:
      "https://github.com/FrameworkComputer/Framework-Laptop-13/blob/main/Display/135_fhd_hads_asm.stp",
    label: "Framework Laptop 13 display assembly STEP",
    author: "Framework Computer Inc.",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    sha256: "29053471f981858325a9798170d3fe87f548c6af271ce268764e6469d41ab0ca",
  },
  hinges: [
    {
      side: "left",
      evidenceId: "cad-hinge-left-step",
      meshUrl: `${assetRoot}/framework-hinge-left.glb`,
      sourceUrl:
        "https://github.com/FrameworkComputer/Framework-Laptop-13/blob/main/Hinges/13_5_hinge_l_assy.stp",
      sha256:
        "4a490d9ed9ce071590b2089b04c46e474cdd6223fea2d514d350f98c181452d2",
      meshSha256:
        "2d708b8d0ce97b902df3570e03275c3c9c4f446f11143f1d9332d8862ad99943",
    },
    {
      side: "right",
      evidenceId: "cad-hinge-right-step",
      meshUrl: `${assetRoot}/framework-hinge-right.glb`,
      sourceUrl:
        "https://github.com/FrameworkComputer/Framework-Laptop-13/blob/main/Hinges/13_5_hinge_R_assy.stp",
      sha256:
        "be1fbe624389687ff992bed8693baedf2a7b29c0bcde167a7c2642678ae426fe",
      meshSha256:
        "8b35689fa7b10de48071858fb8e0be41e940214608f08773dc3ba8ed5c3a2dd4",
    },
  ],
} as const;

export function demoPhotoForEvidence(
  evidenceId: string,
): DemoPhotoAsset | undefined {
  return demoReferenceAssets.photos.find(
    (photo) => photo.evidenceId === evidenceId,
  );
}
