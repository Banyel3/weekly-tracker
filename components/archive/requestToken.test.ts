import { describe, expect, it } from "vitest";
import { createRequestToken } from "./requestToken";

describe("createRequestToken", () => {
  it("keeps only the latest request current", () => {
    const tokens = createRequestToken();
    const older = tokens.next();
    expect(tokens.isCurrent(older)).toBe(true);
    const firstPage = tokens.next();
    expect(tokens.isCurrent(older)).toBe(false);
    expect(tokens.isCurrent(firstPage)).toBe(true);
  });
});
