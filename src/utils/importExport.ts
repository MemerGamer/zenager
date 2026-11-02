// Pure import/export logic. The export is a whitelist-built snapshot of the
// board state: API tokens live under separate localStorage keys and are never
// part of BoardState, and import re-builds every object from known fields so
// unexpected data (e.g. a token smuggled into a file) is dropped.
import type { Issue, Project, Repo } from "~/types";
import { validateGitHubRepo } from "~/utils/github";
import { validateGitLabDomain, validateGitLabProjectPath } from "~/utils/gitlab";
import {
  getRepoId,
  dedupeProjects,
  dedupeRepositories,
  sanitizeSelection,
} from "~/utils/projectState";

export const EXPORT_APP = "zenager";
export const EXPORT_VERSION = 1;

export interface BoardState {
  repositories: Repo[];
  selectedRepositories: string[];
  projects: Project[];
  visibleColumns: string[];
}

export interface ExportFile extends BoardState {
  app: typeof EXPORT_APP;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
}

export type ImportResult =
  | { ok: true; state: BoardState }
  | { ok: false; error: string };

/* ------------------------------ export -------------------------------- */

export const buildExport = (
  state: BoardState,
  now: Date = new Date()
): ExportFile => ({
  app: EXPORT_APP,
  version: EXPORT_VERSION,
  exportedAt: now.toISOString(),
  ...sanitizeState(state),
});

export const serializeExport = (file: ExportFile): string =>
  JSON.stringify(file, null, 2);

export const exportFileName = (now: Date = new Date()): string =>
  `zenager-export-${now.toISOString().slice(0, 10)}.json`;

/* ------------------------------ import -------------------------------- */

class ImportError extends Error {}
const fail = (msg: string): never => {
  throw new ImportError(msg);
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (o: Obj, k: string, where: string): string =>
  typeof o[k] === "string" ? (o[k] as string) : fail(`${where}: "${k}" must be a string`);
const nonEmpty = (o: Obj, k: string, where: string): string => {
  const v = str(o, k, where);
  return v.trim() ? v : fail(`${where}: "${k}" must not be empty`);
};
const optStr = (o: Obj, k: string, where: string): string | undefined =>
  o[k] === undefined ? undefined : str(o, k, where);
const arr = (o: Obj, k: string, where: string): unknown[] =>
  Array.isArray(o[k]) ? (o[k] as unknown[]) : fail(`${where}: "${k}" must be an array`);
const strArr = (o: Obj, k: string, where: string): string[] =>
  arr(o, k, where).map((v, i) =>
    typeof v === "string" ? v : fail(`${where}: "${k}[${i}]" must be a string`)
  );

/** Only http(s) URLs may be imported ("" is allowed for custom items). */
const safeUrl = (o: Obj, k: string, where: string, allowEmpty = false) => {
  const v = str(o, k, where);
  if (allowEmpty && v === "") return v;
  try {
    const u = new URL(v);
    if (u.protocol === "http:" || u.protocol === "https:") return v;
  } catch {}
  return fail(`${where}: "${k}" must be an http(s) URL`);
};
const optUrl = (o: Obj, k: string, where: string) =>
  o[k] === undefined ? undefined : safeUrl(o, k, where);

const parseRepo = (v: unknown, i: number): Repo => {
  const where = `repositories[${i}]`;
  if (!isObj(v)) return fail(`${where} must be an object`);
  switch (v.type) {
    case "github": {
      const url = optUrl(v, "url", where);
      const author = optStr(v, "author", where);
      const owner = nonEmpty(v, "owner", where);
      const repo = nonEmpty(v, "repo", where);
      if (!validateGitHubRepo(owner, repo))
        return fail(`${where}: invalid GitHub owner or repository name`);
      if (author !== undefined && !validateGitHubRepo(author, "x"))
        return fail(`${where}: invalid GitHub author`);
      return {
        type: "github",
        owner,
        repo,
        ...(author !== undefined ? { author } : {}),
        ...(url !== undefined ? { url } : {}),
      };
    }
    case "gitlab": {
      const url = optUrl(v, "url", where);
      const domain = nonEmpty(v, "domain", where);
      const projectPath = nonEmpty(v, "projectPath", where);
      // https only: the stored token is sent to this host on sync
      if (!validateGitLabDomain(domain) || !domain.startsWith("https://"))
        return fail(`${where}: GitLab domain must be an https URL`);
      if (!validateGitLabProjectPath(projectPath))
        return fail(`${where}: invalid GitLab project path`);
      return {
        type: "gitlab",
        domain,
        projectPath,
        ...(url !== undefined ? { url } : {}),
      };
    }
    case "local": {
      const description = optStr(v, "description", where);
      return {
        type: "local",
        id: nonEmpty(v, "id", where),
        name: nonEmpty(v, "name", where),
        ...(description !== undefined ? { description } : {}),
      };
    }
    default:
      return fail(`${where}: unknown repository type`);
  }
};

const parseIssue = (v: unknown, where: string): Issue => {
  if (!isObj(v)) return fail(`${where} must be an object`);
  if (typeof v.id !== "number" || !Number.isFinite(v.id))
    return fail(`${where}: "id" must be a number`);
  if (v.state !== "open" && v.state !== "closed")
    return fail(`${where}: "state" must be "open" or "closed"`);
  const labels = arr(v, "labels", where).map((l, i) => {
    const lw = `${where}.labels[${i}]`;
    if (!isObj(l)) return fail(`${lw} must be an object`);
    return { name: str(l, "name", lw), color: str(l, "color", lw) };
  });
  let assignee: Issue["assignee"];
  if (v.assignee !== undefined) {
    const aw = `${where}.assignee`;
    if (!isObj(v.assignee)) return fail(`${aw} must be an object`);
    assignee = {
      login: str(v.assignee, "login", aw),
      avatar_url: safeUrl(v.assignee, "avatar_url", aw, true),
    };
  }
  if (v.isCustom !== undefined && typeof v.isCustom !== "boolean")
    return fail(`${where}: "isCustom" must be a boolean`);
  const repoId = optStr(v, "repoId", where);
  return {
    id: v.id,
    title: str(v, "title", where),
    body: str(v, "body", where),
    state: v.state,
    labels,
    ...(assignee ? { assignee } : {}),
    created_at: str(v, "created_at", where),
    updated_at: str(v, "updated_at", where),
    html_url: safeUrl(v, "html_url", where, true),
    ...(v.isCustom !== undefined ? { isCustom: v.isCustom } : {}),
    ...(repoId !== undefined ? { repoId } : {}),
  };
};

const parseProject = (v: unknown, i: number): Project => {
  const where = `projects[${i}]`;
  if (!isObj(v)) return fail(`${where} must be an object`);
  return {
    id: nonEmpty(v, "id", where),
    name: str(v, "name", where),
    issues: arr(v, "issues", where).map((x, j) =>
      parseIssue(x, `${where}.issues[${j}]`)
    ),
  };
};

/** Rebuild a state from known fields only, healing duplicates. */
const sanitizeState = (s: BoardState): BoardState => {
  const repositories = dedupeRepositories(s.repositories.map((r, i) => parseRepo(r, i)));
  return {
    repositories,
    selectedRepositories: sanitizeSelection(s.selectedRepositories, repositories),
    projects: dedupeProjects(s.projects.map((p, i) => parseProject(p, i))),
    visibleColumns: [...new Set(s.visibleColumns)],
  };
};

/** Parse and strictly validate the text of an export file. */
export const parseAndValidateImport = (text: string): ImportResult => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "File is not valid JSON" };
  }
  try {
    if (!isObj(data)) return fail("File content must be a JSON object");
    if (data.app !== EXPORT_APP)
      return fail("Not a Zenager export file (wrong or missing \"app\")");
    if (data.version !== EXPORT_VERSION)
      return fail(
        `Unsupported export version ${JSON.stringify(data.version)} (expected ${EXPORT_VERSION})`
      );
    const raw: BoardState = {
      repositories: arr(data, "repositories", "file") as Repo[],
      selectedRepositories: strArr(data, "selectedRepositories", "file"),
      projects: arr(data, "projects", "file") as Project[],
      visibleColumns: strArr(data, "visibleColumns", "file"),
    };
    return { ok: true, state: sanitizeState(raw) };
  } catch (e) {
    if (e instanceof ImportError) return { ok: false, error: e.message };
    throw e;
  }
};

/* ------------------------------- merge -------------------------------- */

/**
 * Merge imported state into the current one. Existing data wins: repos and
 * issues already present are kept, columns are matched by id and gain only
 * the imported issues they do not have yet, and unknown columns are appended.
 */
export const mergeImport = (
  current: BoardState,
  imported: BoardState
): BoardState => {
  const repositories = dedupeRepositories([
    ...current.repositories,
    ...imported.repositories,
  ]);
  const byId = new Map(imported.projects.map((p) => [p.id, p]));
  const merged = current.projects.map((p) => ({
    ...p,
    issues: [...p.issues, ...(byId.get(p.id)?.issues ?? [])],
  }));
  const known = new Set(current.projects.map((p) => p.id));
  const projects = dedupeProjects([
    ...merged,
    ...imported.projects.filter((p) => !known.has(p.id)),
  ]);
  // Never auto-select imported GitLab projects on hosts the user has not
  // configured: selecting triggers a sync that sends the stored token there.
  const trusted = new Set(
    current.repositories.flatMap((r) => (r.type === "gitlab" ? [r.domain] : []))
  );
  const currentIds = new Set(current.repositories.map(getRepoId));
  const importedSelection = imported.selectedRepositories.filter((id) => {
    if (currentIds.has(id)) return true;
    const repo = imported.repositories.find((r) => getRepoId(r) === id);
    return !(repo?.type === "gitlab" && !trusted.has(repo.domain));
  });
  return {
    repositories,
    selectedRepositories: sanitizeSelection(
      [...current.selectedRepositories, ...importedSelection],
      repositories
    ),
    projects,
    visibleColumns: [
      ...new Set([...current.visibleColumns, ...imported.visibleColumns]),
    ].filter((id) => projects.some((p) => p.id === id)),
  };
};
