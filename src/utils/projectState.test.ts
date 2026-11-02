import { describe, expect, test } from "bun:test";
import type { GitHubRepo, GitLabRepo, Issue, Project, Repo } from "~/types";
import {
  addCustomItem,
  addProject,
  addRepository,
  addSelectedRepo,
  dedupeProjects,
  dedupeRepositories,
  getRepoId,
  mergeFetchedIssues,
  removeProject,
  removeRepoIssues,
  removeRepository,
  removeSelectedRepo,
  sanitizeSelection,
} from "./projectState";

const gh = (owner: string, repo: string): GitHubRepo => ({
  type: "github",
  owner,
  repo,
});
const gl = (projectPath: string): GitLabRepo => ({
  type: "gitlab",
  domain: "https://gitlab.com",
  projectPath,
});
const issue = (id: number, repoId?: string, extra: Partial<Issue> = {}): Issue => ({
  id,
  title: `issue ${id}`,
  body: "",
  state: "open",
  labels: [],
  created_at: "",
  updated_at: "",
  html_url: "",
  repoId,
  ...extra,
});
const columns = (): Project[] =>
  ["backlog", "todo", "done"].map((id) => ({ id, name: id, issues: [] }));
const column = (ps: Project[], id: string) => ps.find((p) => p.id === id)!;

// Simulates a signal: updaters always run against the latest value.
const store = <T>(initial: T) => {
  let value = initial;
  return {
    get: () => value,
    set: (fn: (prev: T) => T) => {
      value = fn(value);
    },
  };
};

describe("repositories", () => {
  test("adding several repos sequentially keeps all of them", () => {
    const repos = [gh("a", "one"), gh("a", "two"), gl("g/three")].reduce<Repo[]>(
      addRepository,
      []
    );
    expect(repos.map(getRepoId)).toEqual([
      "github:a/one",
      "github:a/two",
      "gitlab:https://gitlab.com/g/three",
    ]);
  });

  test("concurrent adds against a stale snapshot keep all repos", () => {
    const s = store<Repo[]>([]);
    // Each async handler captured the same stale snapshot but uses an updater.
    const stale = s.get();
    expect(stale).toEqual([]);
    for (const r of [gh("a", "one"), gh("a", "two"), gh("a", "three")]) {
      s.set((prev) => addRepository(prev, r));
    }
    expect(s.get()).toHaveLength(3);
  });

  test("adding the same repo twice does not duplicate", () => {
    let repos = addRepository([], gh("a", "one"));
    repos = addRepository(repos, gh("a", "one"));
    expect(repos).toHaveLength(1);
    expect(addSelectedRepo(addSelectedRepo([], "x"), "x")).toEqual(["x"]);
  });

  test("same name on GitHub and GitLab are distinct", () => {
    const repos = [gh("g", "proj"), gl("g/proj")].reduce<Repo[]>(addRepository, []);
    expect(repos).toHaveLength(2);
    expect(new Set(repos.map(getRepoId)).size).toBe(2);
  });

  test("loading duplicated state from storage dedupes", () => {
    const loaded = [gh("a", "one"), gh("a", "one"), gl("g/x"), gl("g/x")];
    const repos = dedupeRepositories(loaded);
    expect(repos).toHaveLength(2);
    expect(
      sanitizeSelection(
        ["github:a/one", "github:a/one", "github:gone/gone"],
        repos
      )
    ).toEqual(["github:a/one"]);
    const projects = dedupeProjects([
      { id: "todo", name: "Todo", issues: [issue(1, "r"), issue(1, "r")] },
      { id: "todo", name: "Todo", issues: [] },
    ]);
    expect(projects).toHaveLength(1);
    expect(projects[0].issues).toHaveLength(1);
  });

  test("removing one repo does not remove others", () => {
    const repos = [gh("a", "one"), gh("a", "two")].reduce<Repo[]>(addRepository, []);
    const left = removeRepository(repos, "github:a/one");
    expect(left.map(getRepoId)).toEqual(["github:a/two"]);
    expect(removeSelectedRepo(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("columns and issues", () => {
  test("adding a column twice does not duplicate; removing keeps others", () => {
    let ps = addProject(columns(), { id: "qa", name: "QA", issues: [] });
    ps = addProject(ps, { id: "qa", name: "QA", issues: [] });
    ps = addProject(ps, { id: "todo", name: "Todo", issues: [] });
    expect(ps.map((p) => p.id)).toEqual(["backlog", "todo", "done", "qa"]);
    expect(removeProject(ps, "qa").map((p) => p.id)).toEqual([
      "backlog",
      "todo",
      "done",
    ]);
  });

  test("merge places new open issues in backlog, closed in done", () => {
    const merged = mergeFetchedIssues(
      columns(),
      [issue(1, "r"), issue(2, "r", { state: "closed" })],
      ["r"]
    );
    expect(column(merged, "backlog").issues.map((i) => i.id)).toEqual([1]);
    expect(column(merged, "done").issues.map((i) => i.id)).toEqual([2]);
  });

  test("merge preserves column, custom items, and other repos' issues", () => {
    let ps = columns();
    ps = mergeFetchedIssues(ps, [issue(1, "a"), issue(2, "b")], ["a", "b"]);
    // user moves issue 1 to todo and adds a custom item
    const moved = column(ps, "backlog").issues.find((i) => i.id === 1)!;
    ps = ps.map((p) => ({
      ...p,
      issues: p.id === "backlog" ? p.issues.filter((i) => i !== moved) : p.issues,
    }));
    ps = ps.map((p) => (p.id === "todo" ? { ...p, issues: [moved] } : p));
    ps = addCustomItem(ps, "todo", issue(99, undefined, { isCustom: true }));

    // re-sync only repo "a" (repo "b" failed): nothing may be lost
    ps = mergeFetchedIssues(ps, [issue(1, "a")], ["a"]);
    expect(column(ps, "todo").issues.map((i) => i.id).sort()).toEqual([1, 99]);
    expect(column(ps, "backlog").issues.map((i) => i.id)).toEqual([2]);
  });

  test("same numeric id from different repos does not collide or dedupe", () => {
    const merged = mergeFetchedIssues(
      columns(),
      [issue(7, "github:a/x"), issue(7, "gitlab:https://gitlab.com/g/x")],
      ["github:a/x", "gitlab:https://gitlab.com/g/x"]
    );
    expect(column(merged, "backlog").issues).toHaveLength(2);
  });

  test("syncing twice (or duplicate fetched issues) does not duplicate", () => {
    let ps = mergeFetchedIssues(columns(), [issue(1, "r"), issue(1, "r")], ["r"]);
    ps = mergeFetchedIssues(ps, [issue(1, "r")], ["r"]);
    expect(column(ps, "backlog").issues).toHaveLength(1);
  });

  test("concurrent syncs via updaters keep every repo's issues", () => {
    const s = store(columns());
    s.set((prev) => mergeFetchedIssues(prev, [issue(1, "a")], ["a"]));
    s.set((prev) => mergeFetchedIssues(prev, [issue(2, "b")], ["b"]));
    expect(column(s.get(), "backlog").issues.map((i) => i.id).sort()).toEqual([1, 2]);
  });

  test("removeRepoIssues only drops that repo's issues", () => {
    let ps = mergeFetchedIssues(columns(), [issue(1, "a"), issue(2, "b")], ["a", "b"]);
    ps = addCustomItem(ps, "todo", issue(5, undefined, { isCustom: true }));
    ps = removeRepoIssues(ps, "a");
    expect(column(ps, "backlog").issues.map((i) => i.id)).toEqual([2]);
    expect(column(ps, "todo").issues.map((i) => i.id)).toEqual([5]);
  });
});
