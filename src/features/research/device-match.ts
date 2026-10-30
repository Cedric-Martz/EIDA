import type { ResearchSource } from "@/domain/research";

const MODEL_CODE = /\b(?:sm[- ]?)?([a-z]\d{3,4}[a-z]{0,3})\b/gi;
const SCREEN_SIZE = /\b(7\.0|8\.0|10\.1|10\.5|11\.0|12\.4)\b/g;

const SAMSUNG_TAB_SIZE_BY_CODE: Record<string, string> = {
  t230: "7.0",
  t231: "7.0",
  t235: "7.0",
  t330: "8.0",
  t331: "8.0",
  t335: "8.0",
  t530: "10.1",
  t531: "10.1",
  t535: "10.1",
};

function matches(pattern: RegExp, value: string): string[] {
  pattern.lastIndex = 0;
  return Array.from(value.matchAll(pattern), (match) => match[1].toLowerCase());
}

function identity(value: string) {
  const codes = matches(MODEL_CODE, value);
  const explicitSizes = matches(SCREEN_SIZE, value);
  const inferredSizes = codes.flatMap((code) => {
    const size = SAMSUNG_TAB_SIZE_BY_CODE[code];
    return size ? [size] : [];
  });
  return {
    codes: new Set(codes),
    sizes: new Set([...explicitSizes, ...inferredSizes]),
  };
}

/**
 * Reject only explicit conflicts. Generic family guides remain visible, while
 * results naming another model code or another screen-size variant are hidden.
 */
export function sourceMatchesDevice(
  deviceQuery: string,
  source: Pick<ResearchSource, "title" | "summary">,
): boolean {
  const expected = identity(deviceQuery);
  const candidate = identity(`${source.title} ${source.summary ?? ""}`);

  if (
    expected.codes.size > 0 &&
    candidate.codes.size > 0 &&
    !Array.from(candidate.codes).some((code) => expected.codes.has(code))
  ) {
    return false;
  }

  if (
    expected.sizes.size > 0 &&
    candidate.sizes.size > 0 &&
    !Array.from(candidate.sizes).some((size) => expected.sizes.has(size))
  ) {
    return false;
  }

  return true;
}
