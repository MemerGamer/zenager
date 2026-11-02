import { describe, expect, test } from "bun:test";
import type { Issue } from "~/types";
import {
  buildExport,
  exportFileName,
  mergeImport,
  parseAndValidateImport,
  serializeExport,
  type BoardState,
} from "./importExport";

const issue = (id: number, extra: Partial<Issue> = {}): Issue => ({
  id,
  title: `issue ${id}`,
  body: "b",
  state: "open",
  labels: [{ name: "bug", color: "f00" }],
  assignee: { login: "a", avatar_url: "https://a.example/u.png" },
  created_at: "c",
  updated_at: "u",
  html_url: "https://github.com/o/r/issues/1",
  ...extra,
});

const state = (): BoardState => ({
  repositories: [
    { type: "github", owner: "o", repo: "r", author: "me", url: "https://github.com/o/r" },
    { type: "gitlab", domain: "https://gitlab.com", projectPath: "g/p" },
    { type: "local", id: "mine", name: "Mine", description: "d" },
  ],
  selectedRepositories: ["github:o/r", "local:mine"],
  projects: [
    { id: "backlog", name: "Backlog", issues: [issue(1, { repoId: "github:o/r" })] },
    {
      id: "custom-1",
      name: "Custom",
      issues: [issue(2, { isCustom: true, repoId: "local:mine" })],
    },
  ],
  visibleColumns: ["backlog", "custom-1"],
});

const roundtrip = (s: BoardState) => {
  const r = parseAndValidateImport(serializeExport(buildExport(s)));
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

describe("export/import", () => {
  test("header", () => {
    const f = buildExport(state(), new Date("2026-01-02T03:04:05Z"));
    expect(f.app).toBe("zenager");
    expect(f.version).toBe(1);
    expect(f.exportedAt).toBe("2026-01-02T03:04:05.000Z");
    expect(exportFileName(new Date("2026-01-02T03:04:05Z"))).toBe(
      "zenager-export-2026-01-02.json"
    );
  });

  test("roundtrip equals state", () => {
    expect(roundtrip(state())).toEqual(state());
  });

  test("tokens and unknown fields are never exported or imported", () => {
    const s: any = state();
    s.githubApiKey = "ghp_SECRET";
    s.repositories[0].token = "ghp_SECRET";
    s.projects[0].issues[0].apiKey = "ghp_SECRET";
    const text = serializeExport(buildExport(s));
    expect(text).not.toContain("SECRET");
    const file = JSON.parse(text);
    file.token = "glpat-SECRET";
    file.repositories[0].token = "glpat-SECRET";
    const r = parseAndValidateImport(JSON.stringify(file));
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r)).not.toContain("SECRET");
  });

  const valid = () => JSON.parse(serializeExport(buildExport(state())));
  const bad = (mutate: (f: any) => void, msg: RegExp) => {
    const f = valid();
    mutate(f);
    const r = parseAndValidateImport(JSON.stringify(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(msg);
  };

  test("rejects invalid JSON and non-objects", () => {
    expect(parseAndValidateImport("{nope")).toEqual({
      ok: false,
      error: "File is not valid JSON",
    });
    expect(parseAndValidateImport("[]").ok).toBe(false);
    expect(parseAndValidateImport("null").ok).toBe(false);
  });

  test("rejects wrong app and version", () => {
    bad((f) => (f.app = "other"), /Not a Zenager/);
    bad((f) => delete f.app, /Not a Zenager/);
    bad((f) => (f.version = 2), /Unsupported export version 2/);
    bad((f) => delete f.version, /Unsupported export version/);
  });

  test("rejects malformed fields", () => {
    bad((f) => (f.repositories = "x"), /repositories/);
    bad((f) => delete f.projects, /projects/);
    bad((f) => (f.selectedRepositories = [1]), /selectedRepositories/);
    bad((f) => (f.visibleColumns = {}), /visibleColumns/);
    bad((f) => (f.repositories[0].type = "svn"), /unknown repository type/);
    bad((f) => delete f.repositories[0].owner, /owner/);
    bad((f) => (f.repositories[2].id = ""), /id/);
    bad((f) => (f.projects[0].issues[0].id = "1"), /id/);
    bad((f) => (f.projects[0].issues[0].state = "wip"), /state/);
    bad((f) => (f.projects[0].issues[0].labels = null), /labels/);
    bad((f) => (f.projects[0].issues[0].title = 5), /title/);
    bad((f) => (f.projects[0].issues = [null]), /issues\[0\]/);
    bad((f) => (f.projects[1].id = 7), /id/);
  });

  test("rejects unsafe urls and invalid repo identifiers", () => {
    bad((f) => (f.repositories[1].domain = "http://gitlab.com"), /https/);
    bad((f) => (f.repositories[1].projectPath = "a b"), /project path/);
    bad((f) => (f.repositories[0].owner = "../x"), /GitHub/);
    bad((f) => (f.repositories[0].url = "javascript:alert(1)"), /http\(s\)/);
    bad((f) => (f.projects[0].issues[0].html_url = "javascript:alert(1)"), /http\(s\)/);
    bad((f) => (f.projects[0].issues[0].assignee.avatar_url = "data:x"), /http\(s\)/);
  });

  test("heals duplicates on import", () => {
    const f = valid();
    f.repositories.push(f.repositories[0]);
    f.projects[0].issues.push(f.projects[0].issues[0]);
    f.selectedRepositories.push("github:gone/x");
    const r = parseAndValidateImport(JSON.stringify(f));
    expect(r.ok && r.state).toEqual(state());
  });
});

describe("mergeImport", () => {
  test("merging same state is idempotent", () => {
    expect(mergeImport(state(), state())).toEqual(state());
  });

  test("dedupes repos and items, adds new ones", () => {
    const current = state();
    const imported = state();
    imported.repositories.push({ type: "local", id: "new", name: "New" });
    imported.selectedRepositories.push("local:new");
    imported.projects[0].issues.push(issue(9, { repoId: "github:o/r" }));
    imported.projects.push({
      id: "extra",
      name: "Extra",
      issues: [issue(3, { isCustom: true, repoId: "local:new" })],
    });
    imported.visibleColumns.push("extra");
    const m = mergeImport(current, imported);
    expect(m.repositories).toHaveLength(4);
    expect(m.selectedRepositories).toEqual(["github:o/r", "local:mine", "local:new"]);
    expect(m.projects.map((p) => p.id)).toEqual(["backlog", "custom-1", "extra"]);
    expect(m.projects[0].issues.map((i) => i.id)).toEqual([1, 9]);
    expect(m.visibleColumns).toEqual(["backlog", "custom-1", "extra"]);
  });

  test("does not auto-select imported GitLab projects on unknown hosts", () => {
    const current = state();
    const imported = state();
    imported.repositories.push({
      type: "gitlab",
      domain: "https://git.other.example",
      projectPath: "x/y",
    });
    imported.selectedRepositories.push("gitlab:https://git.other.example/x/y");
    const m = mergeImport(current, imported);
    expect(m.repositories).toHaveLength(4);
    expect(m.selectedRepositories).not.toContain("gitlab:https://git.other.example/x/y");
  });

  test("current state wins and is not mutated", () => {
    const current = state();
    current.projects[0].name = "Mine";
    const before = JSON.stringify(current);
    const m = mergeImport(current, state());
    expect(m.projects[0].name).toBe("Mine");
    expect(JSON.stringify(current)).toBe(before);
  });

  test("merge into empty state", () => {
    const empty: BoardState = {
      repositories: [],
      selectedRepositories: [],
      projects: [],
      visibleColumns: [],
    };
    expect(mergeImport(empty, state())).toEqual(state());
  });
});
