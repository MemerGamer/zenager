import { describe, expect, test } from "bun:test";
import type { Issue, Project, Repo } from "~/types";
import { computeTimeline, generateTicks, getIssueSpan } from "./gantt";
import { mapGitHubIssue } from "./github";
import { mapGitLabIssue } from "./gitlab";

const NOW = Date.parse("2026-03-31T00:00:00Z");

const issue = (id: number, over: Partial<Issue> = {}): Issue => ({
  id,
  title: `Issue ${id}`,
  body: "",
  state: "open",
  labels: [],
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
  html_url: `https://example.com/${id}`,
  repoId: "github:o/a",
  ...over,
});
const project = (issues: Issue[]): Project => ({ id: "p", name: "P", issues });
const repos: Repo[] = [
  { type: "github", owner: "o", repo: "a" },
  { type: "local", id: "l1", name: "Local" },
];

describe("getIssueSpan", () => {
  test("open issues end at now", () => {
    expect(getIssueSpan(issue(1), NOW)?.end).toBe(NOW);
  });
  test("closed issues end at closed_at", () => {
    const s = getIssueSpan(
      issue(1, { state: "closed", closed_at: "2026-03-11T00:00:00Z" }),
      NOW,
    );
    expect(s?.end).toBe(Date.parse("2026-03-11T00:00:00Z"));
  });
  test("closed without closed_at falls back to updated_at", () => {
    const s = getIssueSpan(
      issue(1, { state: "closed", updated_at: "2026-03-05T00:00:00Z" }),
      NOW,
    );
    expect(s?.end).toBe(Date.parse("2026-03-05T00:00:00Z"));
  });
  test("invalid created date is excluded", () => {
    expect(getIssueSpan(issue(1, { created_at: "nope" }), NOW)).toBeUndefined();
  });
  test("end never precedes start", () => {
    const s = getIssueSpan(
      issue(1, { state: "closed", closed_at: "2020-01-01T00:00:00Z" }),
      NOW,
    );
    expect(s?.end).toBe(s?.start);
  });
});

describe("computeTimeline", () => {
  test("returns undefined when nothing is plottable", () => {
    expect(computeTimeline([], repos, NOW)).toBeUndefined();
    expect(
      computeTimeline([project([issue(1, { created_at: "x" })])], repos, NOW),
    ).toBeUndefined();
  });

  test("computes range and bar percentages", () => {
    const t = computeTimeline(
      [
        project([
          issue(1, { state: "closed", closed_at: "2026-03-16T00:00:00Z" }),
          issue(2, { created_at: "2026-03-16T00:00:00Z" }),
        ]),
      ],
      repos,
      NOW,
    )!;
    expect(t.start).toBe(Date.parse("2026-03-01T00:00:00Z"));
    expect(t.end).toBe(NOW);
    const [a, b] = t.groups[0].rows;
    expect(a.left).toBe(0);
    expect(a.width).toBeCloseTo(50);
    expect(b.left).toBeCloseTo(50);
    expect(b.width).toBeCloseTo(50);
  });

  test("zero-length bars get a minimum width and stay in bounds", () => {
    const t = computeTimeline(
      [
        project([
          issue(1),
          issue(2, { state: "closed", created_at: "2026-03-31T00:00:00Z" }),
        ]),
      ],
      repos,
      NOW,
    )!;
    const row = t.groups[0].rows.find((r) => r.title === "Issue 2")!;
    expect(row.width).toBeGreaterThan(0);
    expect(row.left + row.width).toBeLessThanOrEqual(100);
  });

  test("groups by repo, sorts groups by name and rows by start, dedupes", () => {
    const t = computeTimeline(
      [
        project([
          issue(1, { created_at: "2026-03-10T00:00:00Z" }),
          issue(2, { created_at: "2026-03-02T00:00:00Z" }),
          issue(1, { created_at: "2026-03-10T00:00:00Z" }),
          issue(3, { repoId: "local:l1", isCustom: true }),
          issue(4, { repoId: undefined, isCustom: true }),
        ]),
      ],
      repos,
      NOW,
    )!;
    expect(t.groups.map((g) => g.name)).toEqual([
      "Custom items",
      "Local",
      "o/a",
    ]);
    expect(t.groups[2].rows.map((r) => r.title)).toEqual([
      "Issue 2",
      "Issue 1",
    ]);
  });
});

describe("generateTicks", () => {
  test("uses month ticks for long ranges", () => {
    const start = Date.parse("2026-01-15T00:00:00Z");
    const end = Date.parse("2026-05-20T00:00:00Z");
    const ticks = generateTicks(start, end);
    expect(ticks.map((t) => t.label)).toEqual([
      "Feb 2026",
      "Mar 2026",
      "Apr 2026",
      "May 2026",
    ]);
    expect(ticks.every((t) => t.left >= 0 && t.left <= 100)).toBe(true);
  });
  test("uses weekly ticks for short ranges", () => {
    const start = Date.parse("2026-03-01T00:00:00Z");
    const ticks = generateTicks(start, Date.parse("2026-03-23T00:00:00Z"));
    expect(ticks.map((t) => t.label)).toEqual([
      "Mar 1",
      "Mar 8",
      "Mar 15",
      "Mar 22",
    ]);
    expect(ticks[0].left).toBe(0);
  });
  test("no ticks for an empty range", () => {
    expect(generateTicks(5, 5)).toEqual([]);
  });
});

describe("mappers preserve dates", () => {
  test("GitHub", () => {
    const i = mapGitHubIssue({
      id: 1,
      title: "t",
      state: "closed",
      labels: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-03T00:00:00Z",
      closed_at: "2026-01-02T00:00:00Z",
      html_url: "u",
    });
    expect(i.created_at).toBe("2026-01-01T00:00:00Z");
    expect(i.closed_at).toBe("2026-01-02T00:00:00Z");
  });
  test("GitLab", () => {
    const i = mapGitLabIssue({
      id: 1,
      title: "t",
      state: "closed",
      labels: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-03T00:00:00Z",
      closed_at: "2026-01-02T00:00:00Z",
      web_url: "u",
    });
    expect(i.state).toBe("closed");
    expect(i.closed_at).toBe("2026-01-02T00:00:00Z");
  });
  test("open issues get null closed_at", () => {
    const i = mapGitHubIssue({
      id: 1,
      title: "t",
      state: "open",
      labels: [],
      created_at: "a",
      updated_at: "b",
      closed_at: null,
      html_url: "u",
    });
    expect(i.closed_at).toBeNull();
  });
});
