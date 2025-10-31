import type { Issue } from "~/types";

function buildHeaders(apiKey?: string): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/json",
    "User-Agent": "Zenager-Kanban/1.0",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

/**
 * Encode project path for GitLab API
 * GitLab API requires URL-encoded project path (namespace%2Fproject-name)
 */
function encodeProjectPath(projectPath: string): string {
  return encodeURIComponent(projectPath);
}

/**
 * Build GitLab API base URL from domain
 */
function getGitLabApiBase(domain: string): string {
  // Remove trailing slash if present
  const cleanDomain = domain.replace(/\/$/, "");
  return `${cleanDomain}/api/v4`;
}

/**
 * Generate a deterministic color from a string (label name)
 * Uses a hash function to ensure the same label always gets the same color
 */
function generateColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate a color from the hash
  // Use a darker, more saturated color palette
  const hue = (hash & 0xff) % 360;
  const saturation = 60 + ((hash >> 8) & 0x3f); // 60-100%
  const lightness = 40 + ((hash >> 16) & 0x1f); // 40-60% (darker)

  // Convert HSL to hex
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;
  if (h < 1 / 6) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 2 / 6) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 3 / 6) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 4 / 6) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 5 / 6) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (n: number) => {
    // Clamp value between 0 and 1, then convert to 0-255 range
    const clamped = Math.max(0, Math.min(1, n + m));
    const hex = Math.round(clamped * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  const hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

  // Validate the color is valid (not transparent/invalid)
  if (hexColor === "#NaNNaNNaN" || hexColor.length !== 7) {
    // Fallback to a default color if calculation fails
    return "#428BCA";
  }

  return hexColor;
}

export async function fetchGitLabIssues(
  domain: string,
  projectPath: string,
  apiKey?: string
): Promise<Issue[]> {
  const allIssues: Issue[] = [];
  let page = 1;
  const perPage = 100;
  let hasMore = true;

  const apiBase = getGitLabApiBase(domain);
  const encodedProjectPath = encodeProjectPath(projectPath);

  while (hasMore) {
    const url = new URL(`${apiBase}/projects/${encodedProjectPath}/issues`);
    url.searchParams.set("per_page", perPage.toString());
    url.searchParams.set("page", page.toString());
    url.searchParams.set("order_by", "created_at");
    url.searchParams.set("sort", "desc");
    url.searchParams.set("state", "all");

    try {
      const response = await fetch(url.toString(), {
        headers: buildHeaders(apiKey),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `GitLab API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (data.length < perPage) {
        hasMore = false;
      }

      const mappedIssues = data.map(
        (issue: any): Issue => ({
          id: issue.id,
          title: issue.title,
          body: issue.description || "",
          state: issue.state === "opened" ? "open" : "closed",
          labels: (issue.labels || []).map((label: any) => {
            let labelName: string;
            let labelColor: string | undefined;

            // GitLab labels can be strings or objects
            if (typeof label === "string") {
              labelName = label;
              labelColor = undefined; // Will generate color from name
            } else {
              // Label is an object
              labelName = (label as { name?: string }).name ?? String(label);
              labelColor = (label as { color?: string }).color;
            }

            const color = labelColor || generateColorFromString(labelName);

            return {
              name: labelName,
              color: color,
            };
          }),
          assignee: issue.assignee
            ? {
                login: issue.assignee.username || issue.assignee.name,
                avatar_url: issue.assignee.avatar_url || "",
              }
            : undefined,
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          html_url: issue.web_url,
        })
      );

      allIssues.push(...mappedIssues);
      page++;

      if (page > 10) {
        console.warn(
          `Reached page limit (10) for ${domain}/${projectPath}. There might be more issues.`
        );
        break;
      }
    } catch (error) {
      console.error(
        `Failed to fetch issues from ${domain}/${projectPath} page ${page}:`,
        error
      );
      throw error;
    }
  }

  console.log(
    `Fetched ${allIssues.length} total issues from ${domain}/${projectPath}`
  );
  return allIssues;
}

export function validateGitLabProjectPath(projectPath: string): boolean {
  const projectPathRegex = /^[a-zA-Z0-9._/-]+$/;
  return (
    projectPathRegex.test(projectPath) &&
    projectPath.length > 0 &&
    projectPath.split("/").length >= 2
  );
}

export function validateGitLabDomain(domain: string): boolean {
  try {
    const url = new URL(domain);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
