import { describe, expect, test } from "bun:test";
import { buildAudienceMonitorData } from "@/lib/audience-monitor.functions";

const ROSTER_HEADER = ["Artist", "Location", "Role", "Instagram Handle", "Instagram URL", "SoundCloud URL", "Resident Advisor URL"];
const IG_HEADER = ["Artist", "Followers", "Collected At", "Raw Timestamp", "Source Status"];
const SC_HEADER = ["Artist", "Followers", "Collected At", "Source Status"];
const RA_HEADER = ["Artist", "Followers / Fans", "Raw Timestamp", "Collected At", "Source Status"];
const MONTHLY_HEADER = ["Artist", "Month", "Followers"];
const HISTORICAL_HEADER = ["Artist", "Platform", "Date", "Followers", "Source"];

function batches(overrides: {
  roster?: unknown[][];
  instagram?: unknown[][];
  soundcloud?: unknown[][];
  residentAdvisor?: unknown[][];
  monthly?: unknown[][];
  historical?: unknown[][];
}) {
  return [
    [ROSTER_HEADER, ...(overrides.roster ?? [])],
    [IG_HEADER, ...(overrides.instagram ?? [])],
    [SC_HEADER, ...(overrides.soundcloud ?? [])],
    [RA_HEADER, ...(overrides.residentAdvisor ?? [])],
    [MONTHLY_HEADER, ...(overrides.monthly ?? [])],
    [HISTORICAL_HEADER, ...(overrides.historical ?? [])],
  ] as never;
}

describe("nthng regression: same-month vs. cross-month growth", () => {
  // From the bug report:
  //   4 Aug 2026 — Viberate  — 15,409
  //   4 Sep 2026 — Viberate  — 15,967
  //   4 Sep 2026 — Minor AM  — 16,060
  // The dashboard used to diff the two 4 Sep observations (+93 / +0.58%).
  // Correct monthly growth compares 4 Aug -> 4 Sep: +651 / +4.22%.
  const data = buildAudienceMonitorData(
    batches({
      roster: [["nthng", "Berlin", "Producer", "nthng", "https://instagram.com/nthng", "", ""]],
      instagram: [["nthng", 16060, "4 Sep 2026", "4 Sep 2026", "OK"]],
      historical: [
        ["nthng", "Instagram", "4 Aug 2026", 15409, "Viberate"],
        ["nthng", "Instagram", "4 Sep 2026", 15967, "Viberate"],
      ],
    }),
  );
  const nthng = data.artists.find((artist) => artist.name === "nthng")!;

  test("current audience is the latest valid observation regardless of source", () => {
    expect(nthng.instagram.audience).toBe(16060);
    expect(nthng.instagram.source).toBe("Minor AM monitoring");
  });

  test("baseline is the latest checkpoint from a genuinely earlier month, not same-month", () => {
    expect(nthng.instagram.baseline).toBe(15409);
    expect(nthng.instagram.baselineAt).toContain("2026-08");
  });

  test("growth is 4 Aug -> 4 Sep (+651 / +4.22%), never 4 Sep -> 4 Sep", () => {
    expect(nthng.instagram.change).toBe(651);
    expect(nthng.instagram.growthPercent).toBeCloseTo(4.22, 2);
  });
});

describe("data rules", () => {
  test("never diffs two observations from the same calendar month", () => {
    const data = buildAudienceMonitorData(
      batches({
        roster: [["only-this-month", null, null, null, null, null, null]],
        instagram: [["only-this-month", 1000, "20 Sep 2026", "20 Sep 2026", "OK"]],
        historical: [["only-this-month", "Instagram", "3 Sep 2026", 950, "Viberate"]],
      }),
    );
    const artist = data.artists.find((entry) => entry.name === "only-this-month")!;
    expect(artist.instagram.audience).toBe(1000);
    expect(artist.instagram.change).toBeNull();
    expect(artist.instagram.growthPercent).toBeNull();
  });

  test("missing data stays null, never coerced to 0", () => {
    const data = buildAudienceMonitorData(
      batches({ roster: [["no-data", null, null, null, null, null, null]] }),
    );
    const artist = data.artists.find((entry) => entry.name === "no-data")!;
    expect(artist.instagram.audience).toBeNull();
    expect(artist.soundcloud.audience).toBeNull();
    expect(artist.residentAdvisor.audience).toBeNull();
    expect(artist.instagram.change).toBeNull();
  });

  test("roster is read dynamically from the Roster tab, not hard-coded", () => {
    const data = buildAudienceMonitorData(
      batches({ roster: [["Brand New Artist", null, null, null, null, null, null]] }),
    );
    expect(data.artists.map((artist) => artist.name)).toEqual(["Brand New Artist"]);
  });

  test("month-only Modash data never gets an invented day", () => {
    const data = buildAudienceMonitorData(
      batches({
        roster: [["legacy-monthly", null, null, null, null, null, null]],
        monthly: [["legacy-monthly", "Aug 2026", 5000]],
      }),
    );
    const artist = data.artists.find((entry) => entry.name === "legacy-monthly")!;
    const point = artist.monthlyHistory.find((entry) => entry.month === "2026-08");
    expect(point?.followers).toBe(5000);
    expect(point?.source).toBe("Modash");
    // Bare "YYYY-MM" — not "2026-08-01T00:00:00.000Z" or any other fabricated day.
    expect(point?.observedAt).toBe("2026-08");
  });

  test("provenance stays visible per observation", () => {
    const data = buildAudienceMonitorData(
      batches({
        roster: [["nthng", null, null, null, null, null, null]],
        instagram: [["nthng", 16060, "4 Sep 2026", "4 Sep 2026", "OK"]],
        historical: [["nthng", "Instagram", "4 Aug 2026", 15409, "Viberate"]],
      }),
    );
    const artist = data.artists.find((entry) => entry.name === "nthng")!;
    expect(artist.instagram.source).toBe("Minor AM monitoring");
    expect(artist.historical.instagram[0]?.source).toBe("Viberate");
  });

  test("monitoring health tracks the last attempt, not just the last success", () => {
    const data = buildAudienceMonitorData(
      batches({
        roster: [["flaky-scraper", null, null, null, null, null, null]],
        // A successful scrape, then a later failed attempt — the artist still
        // has an old audience number, but monitoring health must show broken.
        instagram: [
          ["flaky-scraper", 10000, "1 Aug 2026", "1 Aug 2026", "OK"],
          ["flaky-scraper", null, "1 Sep 2026", "1 Sep 2026", "Profile not found"],
        ],
      }),
    );
    const artist = data.artists.find((entry) => entry.name === "flaky-scraper")!;
    expect(artist.instagram.audience).toBe(10000); // stale but last-known-good
    expect(artist.monitoring.instagram.ok).toBe(false);
    expect(artist.monitoring.instagram.status).toBe("Profile not found");
    expect(artist.monitoring.instagram.lastAttemptAt).toContain("2026-09");
  });

  test("monitoring health is healthy when the last attempt succeeded", () => {
    const data = buildAudienceMonitorData(
      batches({
        roster: [["healthy", null, null, null, null, null, null]],
        instagram: [["healthy", 10000, "1 Sep 2026", "1 Sep 2026", "OK"]],
      }),
    );
    const artist = data.artists.find((entry) => entry.name === "healthy")!;
    expect(artist.monitoring.instagram.ok).toBe(true);
  });

  test("monitoring health has no attempt on record when the scraper has never run", () => {
    const data = buildAudienceMonitorData(
      batches({ roster: [["never-scraped", null, null, null, null, null, null]] }),
    );
    const artist = data.artists.find((entry) => entry.name === "never-scraped")!;
    expect(artist.monitoring.instagram.ok).toBe(false);
    expect(artist.monitoring.instagram.lastAttemptAt).toBeNull();
    expect(artist.monitoring.instagram.status).toBeNull();
  });
});
