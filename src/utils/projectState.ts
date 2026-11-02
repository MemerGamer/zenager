// Pure helpers for board/repository state. Everything here returns new arrays
// and takes the previous state as input so it can be used inside functional
// signal updaters (setX((prev) => fn(prev, ...))) without stale snapshots.
import type { Issue, LocalRepo, Project, Repo } from "~/types";

/** Stable unique key of a repository, distinct across GitHub and GitLab. */
export const getRepoId = (repo: Repo): string => {
  switch (repo.type) {
    case "github":
      return `github:${repo.owner}/${repo.repo}`;
    case "gitlab":
      return `gitlab:${repo.domain}/${repo.projectPath}`;
    case "local":
      return `local:${repo.id}`;
  }
};

/** Unique key of an issue: numeric ids are only unique per source. */
export const getIssueKey = (issue: Issue): string =>
  issue.isCustom
    ? `custom:${issue.id}`
    : `${issue.repoId ?? "unknown"}:${issue.id}`;

const uniqueBy = <T>(items: T[], key: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export const dedupeIssues = (issues: Issue[]): Issue[] =>
  uniqueBy(issues, getIssueKey);

/* ---------------------------- repositories ---------------------------- */

export const dedupeRepositories = (repos: Repo[]): Repo[] =>
  uniqueBy(repos, getRepoId);

export const addRepository = (repos: Repo[], repo: Repo): Repo[] =>
  repos.some((r) => getRepoId(r) === getRepoId(repo)) ? repos : [...repos, repo];

export const removeRepository = (repos: Repo[], repoId: string): Repo[] =>
  repos.filter((r) => getRepoId(r) !== repoId);

export const addSelectedRepo = (selected: string[], repoId: string): string[] =>
  selected.includes(repoId) ? selected : [...selected, repoId];

export const removeSelectedRepo = (
  selected: string[],
  repoId: string
): string[] => selected.filter((id) => id !== repoId);

/** Drop duplicate and dangling ids from a persisted selection. */
export const sanitizeSelection = (
  selected: string[],
  repos: Repo[]
): string[] => {
  const known = new Set(repos.map(getRepoId));
  return uniqueBy(selected, (id) => id).filter((id) => known.has(id));
};

/* --------------------------- local projects --------------------------- */

export const isLocalRepo = (repo: Repo): repo is LocalRepo =>
  repo.type === "local";

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";

export type CreateLocalRepoResult =
  | { ok: true; repo: LocalRepo }
  | { ok: false; error: string };

/**
 * Build a local project from user input. Names are trimmed, must be
 * non-empty and unique (case-insensitive) among existing local projects; the
 * id is a slug made unique against the existing ids.
 */
export const createLocalRepo = (
  existing: Repo[],
  name: string,
  description = ""
): CreateLocalRepoResult => {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, error: "Project name is required" };
  const locals = existing.filter(isLocalRepo);
  if (locals.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, error: "A local project with this name already exists" };
  }
  const taken = new Set(locals.map((r) => r.id));
  const base = slugify(trimmed);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  const desc = description.trim();
  return {
    ok: true,
    repo: { type: "local", id, name: trimmed, ...(desc ? { description: desc } : {}) },
  };
};

/** Repositories that must be fetched on sync: local projects have no remote. */
export const getSyncableRepos = (repos: Repo[], selected: string[]): Repo[] =>
  repos.filter((r) => !isLocalRepo(r) && selected.includes(getRepoId(r)));

/**
 * The local project new custom items should belong to: the only selected
 * local project, if there is exactly one.
 */
export const getTargetLocalRepoId = (
  repos: Repo[],
  selected: string[]
): string | undefined => {
  const ids = repos
    .filter(isLocalRepo)
    .map(getRepoId)
    .filter((id) => selected.includes(id));
  return ids.length === 1 ? ids[0] : undefined;
};

/** Remove only the custom items that belong to the given local project. */
export const removeLocalProjectItems = (
  projects: Project[],
  repoId: string
): Project[] =>
  projects.map((p) => ({
    ...p,
    issues: p.issues.filter((i) => !(i.isCustom && i.repoId === repoId)),
  }));

/* ------------------------------ columns ------------------------------- */

export const dedupeProjects = (projects: Project[]): Project[] =>
  uniqueBy(projects, (p) => p.id).map((p) => ({
    ...p,
    issues: dedupeIssues(p.issues),
  }));

/** Adds a column unless one with the same id exists. */
export const addProject = (projects: Project[], project: Project): Project[] =>
  projects.some((p) => p.id === project.id) ? projects : [...projects, project];

export const removeProject = (projects: Project[], projectId: string) =>
  projects.filter((p) => p.id !== projectId);

export const addColumnId = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids : [...ids, id];

export const addCustomItem = (
  projects: Project[],
  projectId: string,
  item: Issue
): Project[] =>
  projects.map((p) =>
    p.id === projectId && !p.issues.some((i) => getIssueKey(i) === getIssueKey(item))
      ? { ...p, issues: [...p.issues, item] }
      : p
  );

export const updateProjectIssues = (
  projects: Project[],
  projectId: string,
  issues: Issue[]
): Project[] =>
  projects.map((p) => (p.id === projectId ? { ...p, issues } : p));

/**
 * Remove only the issues that were fetched from the given repository
 * (plus legacy fetched issues that carry no repoId). Custom items (including
 * those of local projects) and issues of other repositories are kept.
 */
export const removeRepoIssues = (
  projects: Project[],
  repoId: string
): Project[] =>
  projects.map((p) => ({
    ...p,
    issues: p.issues.filter(
      (i) => i.isCustom || (i.repoId !== undefined && i.repoId !== repoId)
    ),
  }));

/**
 * Merge freshly fetched issues into the *current* projects. Fetched issues
 * keep the column they already live in (closed ones go to "done", new ones to
 * "backlog"); custom items and issues of repositories that were not part of
 * this fetch (`fetchedRepoIds`, e.g. because their request failed) are never
 * touched; duplicates are collapsed.
 */
export const mergeFetchedIssues = (
  projects: Project[],
  fetched: Issue[],
  fetchedRepoIds: string[]
): Project[] => {
  const replaced = new Set(fetchedRepoIds);
  const isKept = (i: Issue) =>
    i.isCustom || (i.repoId !== undefined && !replaced.has(i.repoId));
  const columnOf = new Map<string, string>();
  for (const p of projects) {
    for (const i of p.issues) {
      if (!i.isCustom) columnOf.set(getIssueKey(i), p.id);
    }
  }
  const hasColumn = (id: string) => projects.some((p) => p.id === id);

  const placed = new Map<string, Issue[]>();
  for (const issue of dedupeIssues(fetched)) {
    const existing = columnOf.get(getIssueKey(issue));
    let target: string;
    if (issue.state === "closed") target = "done";
    else if (existing) target = existing;
    else target = "backlog";
    if (!hasColumn(target)) target = hasColumn("backlog") ? "backlog" : projects[0]?.id ?? "";
    placed.set(target, [...(placed.get(target) ?? []), issue]);
  }

  return projects.map((p) => ({
    ...p,
    issues: [
      ...p.issues.filter(isKept),
      ...(placed.get(p.id) ?? []),
    ],
  }));
};
