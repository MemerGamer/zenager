import type { Issue } from "~/types";

const GITHUB_API_BASE = "https://api.github.com";

function buildHeaders(apiKey?: string): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Zenager-Kanban/1.0",
  };

  if (apiKey) {
    headers.Authorization = `token ${apiKey}`;
  }

  return headers;
}

export async function fetchGitHubIssues(
  owner: string,
  repo: string,
  author?: string,
  apiKey?: string
): Promise<Issue[]> {
  const allIssues: Issue[] = [];
  let page = 1;
  const perPage = 100;
  let hasMore = true;

  if (author) {
    return await fetchIssuesWithSearchAPI(owner, repo, author, apiKey);
  }
  while (hasMore) {
    const url = new URL(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues`);
    url.searchParams.set("state", "all");
    url.searchParams.set("per_page", perPage.toString());
    url.searchParams.set("page", page.toString());
    url.searchParams.set("sort", "created");
    url.searchParams.set("direction", "desc");

    try {
      const response = await fetch(url.toString(), {
        headers: buildHeaders(apiKey),
      });

      if (!response.ok) {
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.length < perPage) {
        hasMore = false;
      }

      // Filter out pull requests (they have pull_request property)
      const issues = data.filter((item: any) => !item.pull_request);

      const mappedIssues = issues.map(
        (issue: any): Issue => ({
          id: issue.id,
          title: issue.title,
          body: issue.body || "",
          state: issue.state,
          labels: issue.labels.map((label: any) => ({
            name: label.name,
            color: label.color || "#428BCA",
          })),
          assignee: issue.assignee
            ? {
                login: issue.assignee.login,
                avatar_url: issue.assignee.avatar_url,
              }
            : undefined,
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          html_url: issue.html_url,
        })
      );

      allIssues.push(...mappedIssues);
      page++;

      if (page > 10) {
        console.warn(
          `Reached page limit (10) for ${owner}/${repo}. There might be more issues.`
        );
        break;
      }
    } catch (error) {
      console.error(
        `Failed to fetch issues from ${owner}/${repo} page ${page}:`,
        error
      );
      throw error;
    }
  }

  console.log(`Fetched ${allIssues.length} total issues from ${owner}/${repo}`);
  return allIssues;
}

async function fetchIssuesWithSearchAPI(
  owner: string,
  repo: string,
  author?: string,
  apiKey?: string
): Promise<Issue[]> {
  const allIssues: Issue[] = [];
  let page = 1;
  const perPage = 100;
  let hasMore = true;

  while (hasMore) {
    const query = `repo:${owner}/${repo} is:issue${
      author ? ` assignee:${author}` : ""
    }`;
    const url = new URL(`${GITHUB_API_BASE}/search/issues`);
    url.searchParams.set("q", query);
    url.searchParams.set("per_page", perPage.toString());
    url.searchParams.set("page", page.toString());
    url.searchParams.set("sort", "created");
    url.searchParams.set("order", "desc");

    try {
      const response = await fetch(url.toString(), {
        headers: buildHeaders(apiKey),
      });

      if (!response.ok) {
        throw new Error(
          `GitHub Search API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.items.length < perPage) {
        hasMore = false;
      }

      // The Search API already filters out pull requests when using is:issue
      const mappedIssues = data.items.map(
        (issue: any): Issue => ({
          id: issue.id,
          title: issue.title,
          body: issue.body || "",
          state: issue.state,
          labels: issue.labels.map((label: any) => ({
            name: label.name,
            color: label.color || "#428BCA",
          })),
          assignee: issue.assignee
            ? {
                login: issue.assignee.login,
                avatar_url: issue.assignee.avatar_url,
              }
            : undefined,
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          html_url: issue.html_url,
        })
      );

      allIssues.push(...mappedIssues);
      page++;

      if (page > 10) {
        console.warn(
          `Reached page limit (10) for ${owner}/${repo} search. There might be more issues.`
        );
        break;
      }
    } catch (error) {
      console.error(
        `Failed to fetch issues from ${owner}/${repo} search page ${page}:`,
        error
      );
      throw error;
    }
  }

  console.log(
    `Fetched ${allIssues.length} total issues from ${owner}/${repo} search`
  );
  return allIssues;
}

export function validateGitHubRepo(owner: string, repo: string): boolean {
  const ownerRegex = /^[a-zA-Z0-9]([a-zA-Z0-9]|-(?![.-])){0,38}$/;
  const repoRegex = /^[a-zA-Z0-9._-]+$/;

  return (
    ownerRegex.test(owner) &&
    repoRegex.test(repo) &&
    owner.length > 0 &&
    repo.length > 0
  );
}
