import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// Minimum patched versions for the security updates applied in this change.
const fixedVersions = {
  "fast-uri": "3.1.9",
  fastify: "5.12.8",
  "find-my-way": "9.10.2",
  postcss: "8.5.18",
  "source-map-js": "1.2.2",
  vite: "7.3.7",
  zod: "4.6.6",
  "@vitest/mocker": "4.1.11",
  nanoid: "3.3.16",
  vitest: "4.1.11",
} as const;

function isAtLeast(actual: string, minimum: string) {
  const actualParts = actual.split(".").map(Number);
  const minimumParts = minimum.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    const a = actualParts[i] ?? 0;
    const b = minimumParts[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

describe("resolved dependency versions", () => {
  test("locks the patched versions for every security update", () => {
    const lockfile = JSON.parse(
      readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
    ) as { packages: Record<string, { version?: string }> };

    for (const [name, minimum] of Object.entries(fixedVersions)) {
      const resolved = lockfile.packages[`node_modules/${name}`]?.version;
      expect(resolved, `${name} is missing from the lockfile`).toBeTruthy();
      expect(
        isAtLeast(resolved as string, minimum),
        `${name} resolved to ${resolved}, expected at least ${minimum}`,
      ).toBe(true);
    }
  });
});
