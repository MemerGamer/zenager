// Pure logic for the Gantt overview. An issue's bar runs from its creation
// date to its close date; open issues extend to `now`.
import type { Issue, Project, Repo } from "~/types";
import { getIssueKey, getRepoId } from "./projectState";

const DAY = 24 * 60 * 60 * 1000;
const MIN_BAR_PERCENT = 0.4;
export const CUSTOM_GROUP_ID = "custom";

export interface GanttRow {
  key: string;
  title: string;
  url: string;
  state: Issue["state"];
  start: number;
  end: number;
  /** Left offset and width as percentages of the timeline range. */
  left: number;
  width: number;
}

export interface GanttGroup {
  id: string;
  name: string;
  rows: GanttRow[];
}

export interface GanttTick {
  label: string;
  left: number;
}

export interface Timeline {
  start: number;
  end: number;
  groups: GanttGroup[];
  ticks: GanttTick[];
}

const parseDate = (value: string | null | undefined): number | undefined => {
  if (!value) return undefined;
  const t = Date.parse(value);
  return Number.isNaN(t) ? undefined : t;
};

/** Start/end of an issue in ms, or undefined when it has no valid start. */
export const getIssueSpan = (
  issue: Issue,
  now: number,
): { start: number; end: number } | undefined => {
  const start = parseDate(issue.created_at);
  if (start === undefined) return undefined;
  let end: number;
  if (issue.state === "open") {
    end = now;
  } else {
    // Closed without a (valid) close date: fall back to the last update
    end = parseDate(issue.closed_at) ?? parseDate(issue.updated_at) ?? start;
  }
  return { start, end: Math.max(start, end) };
};

export const getGroupName = (repoId: string, repos: Repo[]): string => {
  if (repoId === CUSTOM_GROUP_ID) return "Custom items";
  const repo = repos.find((r) => getRepoId(r) === repoId);
  if (!repo) return repoId;
  switch (repo.type) {
    case "github":
      return `${repo.owner}/${repo.repo}`;
    case "gitlab":
      return repo.projectPath;
    case "local":
      return repo.name;
  }
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Month ticks for long ranges, weekly (every 7 days) ticks otherwise. */
export const generateTicks = (start: number, end: number): GanttTick[] => {
  const range = end - start;
  const pos = (t: number) => ((t - start) / range) * 100;
  const ticks: GanttTick[] = [];
  if (range <= 0) return ticks;

  if (range > 120 * DAY) {
    const s = new Date(start);
    let y = s.getUTCFullYear();
    let m = s.getUTCMonth();
    // First month boundary at or after the start
    if (Date.UTC(y, m, 1) < start) m++;
    for (;;) {
      const t = Date.UTC(y, m, 1);
      if (t > end) break;
      const d = new Date(t);
      ticks.push({
        label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
        left: pos(t),
      });
      m++;
    }
  } else {
    for (let t = start; t <= end; t += 7 * DAY) {
      const d = new Date(t);
      ticks.push({
        label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
        left: pos(t),
      });
    }
  }
  return ticks;
};

/**
 * Build the timeline for all issues in `projects`. Issues without a valid
 * created date are skipped. Returns undefined if nothing can be plotted.
 */
export const computeTimeline = (
  projects: Project[],
  repos: Repo[],
  now: number,
): Timeline | undefined => {
  const seen = new Set<string>();
  const plotted: Array<{
    issue: Issue;
    groupId: string;
    key: string;
    start: number;
    end: number;
  }> = [];

  for (const project of projects) {
    for (const issue of project.issues) {
      const key = getIssueKey(issue);
      if (seen.has(key)) continue;
      const span = getIssueSpan(issue, now);
      if (!span) continue;
      seen.add(key);
      plotted.push({
        issue,
        key,
        groupId: issue.repoId ?? CUSTOM_GROUP_ID,
        ...span,
      });
    }
  }
  if (plotted.length === 0) return undefined;

  const start = Math.min(...plotted.map((p) => p.start));
  const end = Math.max(...plotted.map((p) => p.end));
  const range = Math.max(end - start, 1);

  const byGroup = new Map<string, GanttRow[]>();
  for (const p of plotted) {
    const width = Math.max(((p.end - p.start) / range) * 100, MIN_BAR_PERCENT);
    // Keep minimum-width bars inside the track
    const left = Math.min(((p.start - start) / range) * 100, 100 - width);
    const row: GanttRow = {
      key: p.key,
      title: p.issue.title,
      url: p.issue.html_url,
      state: p.issue.state,
      start: p.start,
      end: p.end,
      left,
      width,
    };
    byGroup.set(p.groupId, [...(byGroup.get(p.groupId) ?? []), row]);
  }

  const groups: GanttGroup[] = [...byGroup.entries()]
    .map(([id, rows]) => ({
      id,
      name: getGroupName(id, repos),
      rows: rows.sort((a, b) => a.start - b.start || a.end - b.end),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { start, end, groups, ticks: generateTicks(start, end) };
};
