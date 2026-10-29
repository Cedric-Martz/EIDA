import { createElement } from "react";

export function EidaLanding({ onEnter }: { onEnter: () => void }) {
  return createElement(
    "main",
    { className: "landing-page", id: "top" },
    createElement(
      "header",
      { className: "landing-header" },
      createElement(
        "a",
        { className: "landing-brand", href: "#top", "aria-label": "home" },
        createElement("span", null, "E"),
        createElement("strong", null, "EIDA"),
      ),
      createElement(
        "a",
        { className: "landing-header__link", href: "#method" },
        "Our method ",
        createElement("span", { "aria-hidden": true }, "↘"),
      ),
    ),
    createElement(
      "section",
      { className: "landing-hero", "aria-labelledby": "landing-title" },
      createElement(
        "div",
        { className: "landing-hero__copy" },
        createElement(
          "p",
          { className: "landing-eyebrow" },
          "Evidence-based Intelligence for Disassembly & Analysis",
        ),
        createElement(
          "h1",
          { id: "landing-title" },
          "See the object.",
          createElement("br"),
          createElement("em", null, "Understand its parts."),
        ),
        createElement(
          "p",
          { className: "landing-lede" },
          "Explore a device, separate its components, and trace every observation back to its source.",
        ),
      ),
      createElement(
        "div",
        { className: "landing-object", "aria-hidden": true },
        createElement("span", { className: "landing-object__orbit" }),
        createElement("span", {
          className: "landing-object__part landing-object__part--back",
        }),
        createElement("span", {
          className: "landing-object__part landing-object__part--battery",
        }),
        createElement(
          "span",
          { className: "landing-object__part landing-object__part--board" },
          createElement("i"),
          createElement("i"),
          createElement("i"),
        ),
        createElement("span", {
          className: "landing-object__part landing-object__part--screen",
        }),
        createElement("span", {
          className: "landing-object__part landing-object__part--front",
        }),
      ),
      createElement(
        "div",
        { className: "landing-actions" },
        createElement(
          "button",
          { type: "button", className: "landing-cta", onClick: onEnter },
          "Enter the 3D environment ",
          createElement("span", { "aria-hidden": true }, "↗"),
        ),
      ),
    ),
    createElement(
      "section",
      {
        className: "landing-method",
        id: "method",
        "aria-label": "EIDA method",
      },
      createElement("p", null, "Approved photos and documents"),
      createElement("span", { "aria-hidden": true }, "→"),
      createElement("p", null, "Claims linked to evidence"),
      createElement("span", { "aria-hidden": true }, "→"),
      createElement("p", null, "Interactive 3D parts"),
    ),
  );
}
