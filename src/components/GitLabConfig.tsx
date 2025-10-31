import { createSignal, Show } from "solid-js";
import { HiSolidEye, HiSolidEyeSlash } from "solid-icons/hi";
import type { GitLabRepo, GitLabConfigProps } from "~/types";

export default function GitLabConfig(props: GitLabConfigProps) {
  const [url, setUrl] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [showApiKey, setShowApiKey] = createSignal(false);

  const parseGitLabUrl = (url: string): GitLabRepo | null => {
    try {
      const urlObj = new URL(url);

      // Extract domain (protocol + hostname + port if present)
      const domain = `${urlObj.protocol}//${urlObj.host}`;

      // Parse path: /namespace/project-name/-/issues or /namespace/project-name/issues
      // Also handle /namespace/project-name/-/issues/...
      const pathParts = urlObj.pathname.split("/").filter(Boolean);

      // Find where 'issues' starts (could be '/issues' or '/-/issues')
      let issuesIndex = pathParts.indexOf("issues");
      if (issuesIndex === -1) {
        // Try to find '-/issues' pattern
        const dashIndex = pathParts.indexOf("-");
        if (dashIndex !== -1 && pathParts[dashIndex + 1] === "issues") {
          issuesIndex = dashIndex + 1;
        }
      }

      // Extract project path (everything before 'issues' or '-/issues')
      let projectPathParts: string[] = [];
      if (issuesIndex > 0) {
        // Take everything before issues
        projectPathParts = pathParts
          .slice(0, issuesIndex)
          .filter((p) => p !== "-");
      } else if (issuesIndex === -1) {
        // No issues found, use the whole path
        projectPathParts = pathParts.filter((p) => p !== "-");
      }

      // Need at least namespace/project
      if (projectPathParts.length < 1) {
        throw new Error(
          "URL must be a GitLab issues page (e.g., /namespace/project/-/issues)"
        );
      }

      const projectPath = projectPathParts.join("/");

      return {
        type: "gitlab" as const,
        domain,
        projectPath,
        url: url, // Store the full URL for reference
      };
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid URL. Please provide a valid GitLab issues URL."
      );
      return null;
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!url()) return;

    setIsLoading(true);
    setError("");

    const parsedRepo = parseGitLabUrl(url());
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
          Add GitLab Issues (Read-Only)
        </h2>

        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              GitLab API Token (Optional)
            </label>
            <div class="relative">
              <input
                type={showApiKey() ? "text" : "password"}
                value={props.gitlabApiKey}
                onInput={(e) => {
                  props.onApiKeyChange(e.currentTarget.value);
                }}
                placeholder="glpat-xxxxxxxxxxxxxxxxxxxx (for private projects)"
                class="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey())}
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 focus:outline-none"
                title={showApiKey() ? "Hide API token" : "Show API token"}
              >
                <Show
                  when={showApiKey()}
                  fallback={<HiSolidEye class="w-5 h-5" />}
                >
                  <HiSolidEyeSlash class="w-5 h-5" />
                </Show>
              </button>
            </div>
            <p class="text-xs text-gray-400 mt-1">
              Leave empty for public projects. Required for private projects or
              self-hosted instances.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              GitLab Issues URL
            </label>
            <input
              type="url"
              value={url()}
              onInput={(e) => {
                setUrl(e.currentTarget.value);
                setError("");
              }}
              placeholder="https://gitlab.com/namespace/project/-/issues or https://gitlab.example.com/group/project/-/issues"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
            <p class="text-xs text-gray-400 mt-1">
              Paste a GitLab issues URL. Supports both GitLab.com and
              self-hosted instances. Issues will be read-only and
              auto-categorized.
            </p>
            <Show when={error()}>
              <p class="text-xs text-red-400 mt-1">{error()}</p>
            </Show>
          </div>

          <div class="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading() || !url()}
              class="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading() ? "Adding..." : "Add Project Issues"}
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
