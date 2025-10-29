import { createSignal, Show } from "solid-js";
import { HiSolidEye, HiSolidEyeSlash } from "solid-icons/hi";
import type { GitHubRepo } from "~/routes/kanban";

interface GitHubConfigProps {
  onAddRepository: (repo: GitHubRepo) => void;
  onClose: () => void;
  githubApiKey: string;
  onApiKeyChange: (key: string) => void;
}

export default function GitHubConfig(props: GitHubConfigProps) {
  const [url, setUrl] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [showApiKey, setShowApiKey] = createSignal(false);

  const parseGitHubUrl = (url: string): GitHubRepo | null => {
    try {
      const urlObj = new URL(url);

      // Check if it's a GitHub URL
      if (urlObj.hostname !== "github.com") {
        throw new Error("URL must be from GitHub.com");
      }

      // Parse path: /owner/repo/issues?query
      const pathParts = urlObj.pathname.split("/").filter(Boolean);

      // Check if it's a GitHub issues page
      if (pathParts.length < 3 || pathParts[2] !== "issues") {
        throw new Error(
          "URL must be a GitHub issues page (e.g., /owner/repo/issues)"
        );
      }

      const owner = pathParts[0];
      const repo = pathParts[1];

      // Parse query parameters for assignee filter
      const searchParams = urlObj.searchParams;
      const assignee = searchParams.get("assignee");
      const author = searchParams.get("author");

      // Extract assignee from the query string if present
      let extractedAssignee = assignee || author;
      if (!extractedAssignee) {
        // Try to extract from the q parameter
        const qParam = searchParams.get("q");
        if (qParam) {
          const assigneeMatch = qParam.match(/assignee:(\w+)/);
          if (assigneeMatch) {
            extractedAssignee = assigneeMatch[1];
          }
        }
      }

      return {
        owner,
        repo,
        author: extractedAssignee || undefined,
        url: url, // Store the full URL for reference
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid URL");
      return null;
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!url()) return;

    setIsLoading(true);
    setError("");

    const parsedRepo = parseGitHubUrl(url());
    if (parsedRepo) {
      props.onAddRepository(parsedRepo);
      setUrl("");
      props.onClose();
    }

    setIsLoading(false);
  };

  return (
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h2 class="text-xl font-bold mb-4 text-white">
          Add GitHub Issues (Read-Only)
        </h2>

        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              GitHub API Key (Optional)
            </label>
            <div class="relative">
              <input
                type={showApiKey() ? "text" : "password"}
                value={props.githubApiKey}
                onInput={(e) => {
                  props.onApiKeyChange(e.currentTarget.value);
                }}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (for private repositories)"
                class="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey())}
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 focus:outline-none"
                title={showApiKey() ? "Hide API key" : "Show API key"}
              >
                <Show when={showApiKey()} fallback={<HiSolidEye class="w-5 h-5" />}>
                  <HiSolidEyeSlash class="w-5 h-5" />
                </Show>
              </button>
            </div>
            <p class="text-xs text-gray-400 mt-1">
              Leave empty for public repositories. Required for private
              repositories.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              GitHub Issues URL
            </label>
            <input
              type="url"
              value={url()}
              onInput={(e) => {
                setUrl(e.currentTarget.value);
                setError("");
              }}
              placeholder="https://github.com/owner/repo/issues?q=is:issue state:open assignee:username"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p class="text-xs text-gray-400 mt-1">
              Paste a GitHub issues URL with any filters you want. Issues will
              be read-only and auto-categorized.
            </p>
            <Show when={error()}>
              <p class="text-xs text-red-400 mt-1">{error()}</p>
            </Show>
          </div>

          <div class="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading() || !url()}
              class="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading() ? "Adding..." : "Add Repository Issues"}
            </button>
            <button
              type="button"
              onClick={props.onClose}
              class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
