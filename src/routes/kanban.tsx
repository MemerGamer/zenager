import { createSignal, createEffect, For, Show, onMount } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import {
  HiSolidCog6Tooth,
  HiSolidPlus,
  HiSolidFolderPlus,
  HiSolidArrowPath,
  HiSolidTrash,
  HiSolidEye,
  HiSolidEyeSlash,
  HiSolidCheck,
  HiSolidChevronDown,
  HiSolidChevronUp,
} from "solid-icons/hi";
import KanbanBoard from "~/components/KanbanBoard";
import GitHubConfig from "~/components/GitHubConfig";
import GitLabConfig from "~/components/GitLabConfig";
import ProjectConfig from "~/components/ProjectConfig";
import RepositoryDropdown from "~/components/RepositoryDropdown";
import ColumnManager from "~/components/ColumnManager";
import CustomItemCreator from "~/components/CustomItemCreator";
import { fetchGitHubIssues } from "~/utils/github";
import { fetchGitLabIssues } from "~/utils/gitlab";
import type {
  Issue,
  Project,
  GitHubRepo,
  GitLabRepo,
  Repo,
  DefaultColumn,
} from "~/types";

export type { Issue, Project, GitHubRepo, GitLabRepo, Repo };
const DEFAULT_COLUMNS: DefaultColumn[] = [
  { id: "backlog", name: "Backlog" },
  { id: "todo", name: "Todo" },
  { id: "in-progress", name: "In Progress" },
  { id: "code-review", name: "Code Review" },
  { id: "blocked", name: "Blocked" },
  { id: "done", name: "Done" },
];

export default function Kanban() {
  const [projects, setProjects] = makePersisted(createSignal<Project[]>([]), {
    name: "zenager-projects",
  });
  const [repositories, setRepositories] = makePersisted(
    createSignal<Repo[]>([]),
    {
      name: "zenager-repositories",
    }
  );
  const [selectedRepositories, setSelectedRepositories] = makePersisted(
    createSignal<string[]>([]),
    {
      name: "zenager-selected-repos",
    }
  );
  const [visibleColumns, setVisibleColumns] = makePersisted(
    createSignal<string[]>([
      "backlog",
      "todo",
      "in-progress",
      "code-review",
      "blocked",
      "done",
    ]),
    {
      name: "zenager-visible-columns",
    }
  );
  const [isLoading, setIsLoading] = createSignal(false);
  const [showGitHubConfig, setShowGitHubConfig] = createSignal(false);
  const [showGitLabConfig, setShowGitLabConfig] = createSignal(false);
  const [showProjectConfig, setShowProjectConfig] = createSignal(false);
  const [showColumnManager, setShowColumnManager] = createSignal(false);
  const [showCustomItemCreator, setShowCustomItemCreator] = createSignal(false);
  const [customItemProjectId, setCustomItemProjectId] = createSignal("");
  const [isClient, setIsClient] = createSignal(false);
  const [showProjectManagement, setShowProjectManagement] = createSignal(false);
  const [isEditMode, setIsEditMode] = createSignal(false);
  const [githubApiKey, setGithubApiKey] = makePersisted(
    createSignal<string>(""),
    {
      name: "zenager-github-api-key",
    }
  );
  const [gitlabApiKey, setGitlabApiKey] = makePersisted(
    createSignal<string>(""),
    {
      name: "zenager-gitlab-api-key",
    }
  );

  onMount(() => {
    setIsClient(true);
    if (projects().length === 0) {
      initializeDefaultColumns();
    }
    // Auto-hide project management if repositories are already configured
    if (repositories().length > 0) {
      setShowProjectManagement(false);
    }
  });

  const initializeDefaultColumns = () => {
    const defaultProjects = DEFAULT_COLUMNS.map((column) => ({
      id: column.id,
      name: column.name,
      issues: [],
    }));
    setProjects(defaultProjects);
  };

  // Helper function to generate a unique ID for a repository
  const getRepoId = (repo: Repo): string => {
    if (repo.type === "github") {
      return `github:${repo.owner}/${repo.repo}`;
    } else {
      return `gitlab:${repo.domain}/${repo.projectPath}`;
    }
  };

  const addRepository = (repo: Repo) => {
    setRepositories((prev) => [...prev, repo]);
    const repoId = getRepoId(repo);
    setSelectedRepositories((prev) => [...prev, repoId]);
    // Auto-hide project management after adding first repository
    if (repositories().length === 0) {
      setShowProjectManagement(false);
    }
  };

  const addGitHubRepository = (repo: GitHubRepo) => {
    addRepository(repo);
  };

  const addGitLabRepository = (repo: GitLabRepo) => {
    addRepository(repo);
  };

  const removeRepository = (index: number) => {
    const repo = repositories()[index];
    if (repo) {
      const repoId = getRepoId(repo);
      setSelectedRepositories((prev) => prev.filter((id) => id !== repoId));
    }
    setRepositories((prev) => prev.filter((_, i) => i !== index));
  };

  const deleteRepository = (repoId: string) => {
    setRepositories((prev) =>
      prev.filter((repo) => getRepoId(repo) !== repoId)
    );
    setSelectedRepositories((prev) => prev.filter((id) => id !== repoId));
    setProjects((prev) =>
      prev.map((project) => ({
        ...project,
        issues: [],
      }))
    );
  };

  const toggleRepository = async (repoId: string) => {
    const isCurrentlySelected = selectedRepositories().includes(repoId);

    if (isCurrentlySelected) {
      // Deselecting - remove issues from this repository
      setSelectedRepositories((prev) => prev.filter((id) => id !== repoId));

      // Clear all issues from all columns
      setProjects((prev) =>
        prev.map((project) => ({ ...project, issues: [] }))
      );

      // Re-fetch issues from remaining selected repositories
      if (selectedRepositories().length > 1) {
        await fetchIssuesFromRepos();
      }
    } else {
      // Selecting - add to selected repositories
      setSelectedRepositories((prev) => [...prev, repoId]);

      // Fetch issues from all selected repositories including the new one
      await fetchIssuesFromRepos();
    }
  };

  const selectAllRepositories = async () => {
    setSelectedRepositories(repositories().map((repo) => getRepoId(repo)));
    // Fetch issues from all repositories
    await fetchIssuesFromRepos();
  };

  const selectNoneRepositories = () => {
    setSelectedRepositories([]);
    // Clear all issues
    setProjects((prev) => prev.map((project) => ({ ...project, issues: [] })));
  };

  const toggleColumn = (columnId: string) => {
    setVisibleColumns((prev) =>
      prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId]
    );
  };

  const addProject = (project: Project) => {
    setProjects((prev) => [...prev, project]);
    setVisibleColumns((prev) => [...prev, project.id]);
  };

  const removeProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setVisibleColumns((prev) => prev.filter((id) => id !== projectId));
  };

  const addCustomItem = (projectId: string, item: Issue) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? { ...project, issues: [...project.issues, item] }
          : project
      )
    );
  };

  const openCustomItemCreator = (projectId: string) => {
    setCustomItemProjectId(projectId);
    setShowCustomItemCreator(true);
  };

  const fetchIssuesFromRepos = async () => {
    setIsLoading(true);
    try {
      const allIssues: Issue[] = [];
      const selectedRepos = selectedRepositories();

      if (selectedRepos.length === 0) {
        setIsLoading(false);
        return;
      }

      // Get current projects state before fetching new issues
      const currentProjects = projects();

      for (const repo of repositories()) {
        const repoId = getRepoId(repo);
        if (selectedRepos.includes(repoId)) {
          try {
            if (repo.type === "github") {
              const issues = await fetchGitHubIssues(
                repo.owner,
                repo.repo,
                repo.author,
                githubApiKey()
              );
              allIssues.push(...issues);
            } else if (repo.type === "gitlab") {
              const issues = await fetchGitLabIssues(
                repo.domain,
                repo.projectPath,
                gitlabApiKey()
              );
              allIssues.push(...issues);
            }
          } catch (error) {
            console.error(`Failed to fetch issues from ${repoId}:`, error);
          }
        }
      }

      const categorizedIssues = categorizeIssuesByState(
        allIssues,
        currentProjects
      );

      setProjects((prev) => {
        return prev.map((project) => {
          const projectIssues = categorizedIssues[project.id] || [];
          return {
            ...project,
            issues: projectIssues,
          };
        });
      });
    } catch (error) {
      console.error("Failed to fetch issues:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const categorizeIssuesByState = (
    issues: Issue[],
    existingProjects: Project[]
  ): Record<string, Issue[]> => {
    const categorized: Record<string, Issue[]> = {
      backlog: [],
      todo: [],
      "in-progress": [],
      "code-review": [],
      blocked: [],
      done: [],
    };

    // Create a map of existing issues by their ID for quick lookup
    const existingIssuesMap = new Map<
      number,
      { issue: Issue; columnId: string }
    >();
    existingProjects.forEach((project) => {
      project.issues.forEach((issue) => {
        existingIssuesMap.set(issue.id, { issue, columnId: project.id });
      });
    });

    issues.forEach((issue) => {
      const existingIssue = existingIssuesMap.get(issue.id);

      if (issue.state === "closed") {
        // Closed issues always go to Done, regardless of previous position
        categorized.done.push(issue);
      } else if (existingIssue) {
        // Preserve existing column position for open issues
        categorized[existingIssue.columnId].push(issue);
      } else {
        // New open issues go to Backlog
        categorized.backlog.push(issue);
      }
    });

    return categorized;
  };

  const updateProject = (projectId: string, updatedIssues: Issue[]) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? { ...project, issues: updatedIssues }
          : project
      )
    );
  };

  const reorderProjects = (reorderedProjects: Project[]) => {
    setProjects(reorderedProjects);
  };

  return (
    <div class="min-h-screen bg-gray-900 text-white">
      <div class="container mx-auto px-4 py-8">
        <div class="mb-8">
          <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-4">
              <button
                onClick={() =>
                  setShowProjectManagement(!showProjectManagement())
                }
                class="bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 flex items-center gap-2 transition-colors"
              >
                <HiSolidCog6Tooth class="w-4 h-4 text-gray-400" />
                <span class="text-white text-sm">Project Management</span>
                {showProjectManagement() ? (
                  <HiSolidChevronUp class="w-4 h-4 text-gray-400" />
                ) : (
                  <HiSolidChevronDown class="w-4 h-4 text-gray-400" />
                )}
              </button>

              <Show when={isClient() && repositories().length > 0}>
                <div class="flex items-center gap-2">
                  <span class="text-gray-400 text-sm">Active Repos:</span>
                  <div class="flex gap-1">
                    <For each={selectedRepositories()}>
                      {(repoId) => {
                        const repo = repositories().find(
                          (r) => getRepoId(r) === repoId
                        );
                        const displayName = repo
                          ? repo.type === "github"
                            ? `${repo.owner}/${repo.repo}`
                            : (() => {
                                if (!repo.projectPath) {
                                  return "Invalid GitLab project";
                                }
                                try {
                                  const hostname = new URL(repo.domain)
                                    .hostname;
                                  const projectName =
                                    repo.projectPath.split("/").pop() ||
                                    repo.projectPath;
                                  return `${hostname}/${projectName}`;
                                } catch {
                                  // Fallback if domain is invalid
                                  return repo.projectPath
                                    ? repo.projectPath.split("/").pop() ||
                                        repo.projectPath
                                    : "Invalid GitLab project";
                                }
                              })()
                          : repoId;
                        return (
                          <button
                            onClick={() => toggleRepository(repoId)}
                            class={`${
                              repo?.type === "gitlab"
                                ? "bg-orange-600 hover:bg-orange-700"
                                : "bg-blue-600 hover:bg-blue-700"
                            } text-white px-2 py-1 rounded text-xs transition-colors`}
                          >
                            {displayName}
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </div>
              </Show>
            </div>

            <div class="flex items-center gap-2">
              <button
                onClick={() => setShowGitHubConfig(true)}
                class="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
              >
                <HiSolidFolderPlus class="w-4 h-4" />
                Add GitHub
              </button>
              <button
                onClick={() => setShowGitLabConfig(true)}
                class="bg-orange-600 hover:bg-orange-700 px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
              >
                <HiSolidFolderPlus class="w-4 h-4" />
                Add GitLab
              </button>

              <button
                onClick={() => setIsEditMode(!isEditMode())}
                class={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
                  isEditMode()
                    ? "bg-orange-600 hover:bg-orange-700 text-white"
                    : "bg-gray-600 hover:bg-gray-700 text-white"
                }`}
              >
                <HiSolidCog6Tooth class="w-4 h-4" />
                {isEditMode() ? "Exit Edit" : "Edit Mode"}
              </button>

              <Show when={isClient() && selectedRepositories().length > 0}>
                <button
                  onClick={fetchIssuesFromRepos}
                  disabled={isLoading()}
                  class="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-all duration-200 font-medium flex items-center gap-2"
                >
                  <HiSolidArrowPath
                    class={`w-4 h-4 ${isLoading() ? "animate-spin" : ""}`}
                  />
                  {isLoading() ? "Syncing..." : "Sync Issues"}
                </button>
              </Show>
            </div>
          </div>

          <Show when={showProjectManagement()}>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <HiSolidFolderPlus class="w-5 h-5 text-gray-400" />
                  Repository Integration
                </h3>
                <div class="space-y-4">
                  <RepositoryDropdown
                    repositories={repositories()}
                    selectedRepositories={selectedRepositories()}
                    onToggleRepository={toggleRepository}
                    onDeleteRepository={deleteRepository}
                    onSelectAll={selectAllRepositories}
                    onSelectNone={selectNoneRepositories}
                  />
                </div>
              </div>

              <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <HiSolidCog6Tooth class="w-5 h-5 text-gray-400" />
                  Board Management
                </h3>
                <div class="space-y-2">
                  <button
                    onClick={() => setShowColumnManager(true)}
                    class="w-full bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-md transition-colors flex items-center gap-2 text-sm"
                  >
                    <HiSolidCog6Tooth class="w-4 h-4" />
                    Manage Columns
                  </button>
                  <button
                    onClick={() => setShowProjectConfig(true)}
                    class="w-full bg-green-600 hover:bg-green-700 px-3 py-2 rounded-md transition-colors flex items-center gap-2 text-sm"
                  >
                    <HiSolidPlus class="w-4 h-4" />
                    Add Column
                  </button>
                  <button
                    onClick={() => setShowGitHubConfig(true)}
                    class="w-full bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-md transition-colors flex items-center gap-2 text-sm"
                  >
                    <HiSolidFolderPlus class="w-4 h-4" />
                    Add GitHub Repo
                  </button>
                  <button
                    onClick={() => setShowGitLabConfig(true)}
                    class="w-full bg-orange-600 hover:bg-orange-700 px-3 py-2 rounded-md transition-colors flex items-center gap-2 text-sm"
                  >
                    <HiSolidFolderPlus class="w-4 h-4" />
                    Add GitLab Project
                  </button>
                </div>
              </div>

              <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <HiSolidEye class="w-5 h-5 text-gray-400" />
                  Custom Columns
                </h3>
                <div class="space-y-2">
                  <For
                    each={projects().filter(
                      (p) => !DEFAULT_COLUMNS.some((d) => d.id === p.id)
                    )}
                  >
                    {(project) => (
                      <div class="flex items-center justify-between bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-md transition-colors group">
                        <div class="flex items-center gap-2">
                          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span class="text-white text-sm">{project.name}</span>
                          <span class="text-gray-400 text-xs">
                            ({project.issues.length})
                          </span>
                        </div>
                        <button
                          title="Remove project"
                          onClick={() => removeProject(project.id)}
                          class="p-1 text-gray-400 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <HiSolidTrash class="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </For>
                  <Show
                    when={
                      projects().filter(
                        (p) => !DEFAULT_COLUMNS.some((d) => d.id === p.id)
                      ).length === 0
                    }
                  >
                    <div class="text-center py-6">
                      <HiSolidEyeSlash class="w-8 h-8 text-gray-500 mx-auto mb-2" />
                      <p class="text-gray-500 text-sm">No custom columns</p>
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          </Show>
        </div>

        <Show when={isClient()}>
          <Show when={isEditMode()}>
            <div class="mb-4 p-3 bg-orange-900 border border-orange-600 rounded-lg">
              <div class="flex items-center gap-2">
                <HiSolidCog6Tooth class="w-5 h-5 text-orange-400" />
                <span class="text-orange-200 text-sm font-medium">
                  Edit Mode: Drag columns to reorder them
                </span>
              </div>
            </div>
          </Show>

          <Show
            when={projects().length > 0}
            fallback={
              <div class="text-center py-12">
                <p class="text-gray-400 text-lg mb-4">
                  No projects yet. Create a project or add issues from GitHub or
                  GitLab to get started.
                </p>
                <div class="flex gap-4 justify-center">
                  <button
                    onClick={() => setShowProjectConfig(true)}
                    class="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg transition-colors"
                  >
                    Create Column
                  </button>
                  <button
                    onClick={() => setShowGitHubConfig(true)}
                    class="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg transition-colors"
                  >
                    Add GitHub Issues
                  </button>
                  <button
                    onClick={() => setShowGitLabConfig(true)}
                    class="bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-lg transition-colors"
                  >
                    Add GitLab Issues
                  </button>
                </div>
              </div>
            }
          >
            <KanbanBoard
              projects={projects().filter((p) =>
                visibleColumns().includes(p.id)
              )}
              onUpdateProject={updateProject}
              onReorderProjects={reorderProjects}
              visibleColumns={visibleColumns()}
              onAddCustomItem={openCustomItemCreator}
              isEditMode={isEditMode()}
            />
          </Show>
        </Show>

        <Show when={showGitHubConfig()}>
          <GitHubConfig
            onAddRepository={addGitHubRepository}
            onClose={() => setShowGitHubConfig(false)}
            githubApiKey={githubApiKey()}
            onApiKeyChange={setGithubApiKey}
          />
        </Show>

        <Show when={showGitLabConfig()}>
          <GitLabConfig
            onAddRepository={addGitLabRepository}
            onClose={() => setShowGitLabConfig(false)}
            gitlabApiKey={gitlabApiKey()}
            onApiKeyChange={setGitlabApiKey}
          />
        </Show>

        <Show when={showProjectConfig()}>
          <ProjectConfig
            onAddProject={addProject}
            onClose={() => setShowProjectConfig(false)}
          />
        </Show>

        <Show when={showColumnManager()}>
          <ColumnManager
            projects={projects()}
            visibleColumns={visibleColumns()}
            onToggleColumn={toggleColumn}
            onClose={() => setShowColumnManager(false)}
          />
        </Show>

        <Show when={showCustomItemCreator()}>
          <CustomItemCreator
            projectId={customItemProjectId()}
            onAddItem={addCustomItem}
            onClose={() => setShowCustomItemCreator(false)}
          />
        </Show>
      </div>
    </div>
  );
}
