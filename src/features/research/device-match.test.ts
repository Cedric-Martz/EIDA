import { describe, expect, it } from "vitest";
import { sourceMatchesDevice } from "./device-match";

const source = (title: string) => ({ title, summary: undefined });

describe("sourceMatchesDevice", () => {
  it("maps SM-T530 to the 10.1 variant and rejects 7.0 guides", () => {
    expect(
      sourceMatchesDevice(
        "Samsung Galaxy Tab 4 SM-T530",
        source("Samsung Galaxy Tab 4 10.1 Battery Replacement"),
      ),
    ).toBe(true);
    expect(
      sourceMatchesDevice(
        "Samsung Galaxy Tab 4 SM-T530",
        source("Samsung Galaxy Tab 4 7.0 Battery Replacement"),
      ),
    ).toBe(false);
  });

  it("rejects an explicitly different model code", () => {
    expect(
      sourceMatchesDevice(
        "Samsung Galaxy Tab 4 SM-T530",
        source("Samsung Galaxy Tab 4 SM-T230NU Disassembly"),
      ),
    ).toBe(false);
  });

  it("keeps generic family guides when no conflict is stated", () => {
    expect(
      sourceMatchesDevice(
        "Samsung Galaxy Tab 4 SM-T530",
        source("Samsung Galaxy Tab 4 repair overview"),
      ),
    ).toBe(true);
  });
});
