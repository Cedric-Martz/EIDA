import { describe, expect, it } from "vitest";
import {
  normalizeResearchQuery,
  sanitizeNetworkPayload,
  sanitizePlainText,
} from "./sanitize";

describe("research input and response sanitization", () => {
  it("normalizes query whitespace, controls and markup", () => {
    expect(normalizeResearchQuery("  <b>Galaxy\u0000 Tab</b>   SM-T530 ")).toBe(
      "Galaxy Tab SM-T530",
    );
  });

  it("bounds plain text", () => {
    expect(sanitizePlainText("abcdef", 4)).toBe("abcd");
  });

  it("sanitizes nested provider data and ignores prototype keys", () => {
    const value = JSON.parse(
      '{"title":"<script>alert(1)</script> Manual","nested":["A\\u0000B"],"__proto__":{"polluted":true}}',
    );
    expect(sanitizeNetworkPayload(value)).toEqual({
      title: "alert(1) Manual",
      nested: ["A B"],
    });
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("cuts off unexpectedly deep response structures", () => {
    const deep = { level: { level: {} as unknown } };
    let cursor = deep.level.level as Record<string, unknown>;
    for (let index = 0; index < 25; index += 1) {
      cursor.level = {};
      cursor = cursor.level as Record<string, unknown>;
    }
    expect(JSON.stringify(sanitizeNetworkPayload(deep))).toContain("null");
  });
});
