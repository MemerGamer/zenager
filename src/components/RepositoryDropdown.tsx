import { For, Show, createSignal, onMount, onCleanup } from "solid-js";
import {
  HiSolidArrowTopRightOnSquare,
  HiSolidTrash,
  HiSolidCheck,
  HiSolidChevronDown,
  HiSolidChevronUp,
} from "solid-icons/hi";
import type { GitHubRepo } from "~/routes/kanban";

interface RepositoryDropdownProps {
  repositories: GitHubRepo[];
  selectedRepositories: string[];
  onToggleRepository: (repoId: string) => void;
  onDeleteRepository: (repoId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

export default function RepositoryDropdown(props: RepositoryDropdownProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;

  const getRepoId = (repo: GitHubRepo) => `${repo.owner}/${repo.repo}`;
  const isSelected = (repo: GitHubRepo) =>
    props.selectedRepositories.includes(getRepoId(repo));

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  onMount(() => {
    if (typeof document !== "undefined") {
      document.addEventListener("mousedown", handleClickOutside);
    }
  });

  onCleanup(() => {
    if (typeof document !== "undefined") {
      document.removeEventListener("mousedown", handleClickOutside);
    }
  });

  const handleDelete = (repo: GitHubRepo, e: Event) => {
    e.stopPropagation();
    const repoId = getRepoId(repo);
    props.onDeleteRepository(repoId);
  };

  const selectedCount = () => props.selectedRepositories.length;
  const totalCount = () => props.repositories.length;

  return (
    <div class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-lg font-semibold">Repositories</h2>
        <div class="flex gap-2">
          <button
            onClick={props.onSelectAll}
            class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
          >
            Select All
          </button>
          <button
            onClick={props.onSelectNone}
            class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
          >
            Select None
          </button>
        </div>
      </div>

      <div class="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen())}
          class="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-left flex items-center justify-between hover:bg-gray-700 transition-colors"
        >
          <span class="text-white text-sm">
            {selectedCount() === 0
              ? "Select repositories"
              : `${selectedCount()} selected`}
          </span>
          {isOpen() ? (
            <HiSolidChevronUp class="w-4 h-4 text-gray-400" />
          ) : (
            <HiSolidChevronDown class="w-4 h-4 text-gray-400" />
          )}
        </button>

        <Show when={isOpen()}>
          <div class="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
            <Show
              when={props.repositories.length > 0}
              fallback={
                <div class="p-3 text-gray-500 text-sm text-center">
                  No repositories
                </div>
              }
            >
              <For each={props.repositories}>
                {(repo) => {
                  const repoId = getRepoId(repo);
                  const selected = isSelected(repo);

                  return (
                    <div class="border-b border-gray-700 last:border-b-0">
                      <div class="flex items-center justify-between p-2 hover:bg-gray-700 transition-colors">
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                          <button
                            onClick={() => props.onToggleRepository(repoId)}
                            class={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              selected
                                ? "bg-blue-600 border-blue-600"
                                : "border-gray-500 hover:border-gray-400"
                            }`}
                          >
                            <Show when={selected}>
                              <HiSolidCheck class="w-3 h-3 text-white" />
                            </Show>
                          </button>

                          <div class="flex-1 min-w-0">
                            <span class="text-white text-sm truncate block">
                              {repo.owner}/{repo.repo}
                            </span>
                            <Show when={repo.author}>
                              <p class="text-gray-400 text-xs truncate">
                                by {repo.author}
                              </p>
                            </Show>
                          </div>
                        </div>

                        <div class="flex items-center gap-1">
                          <a
                            href={
                              repo.url ||
                              `https://github.com/${repo.owner}/${repo.repo}/issues`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-gray-400 hover:text-blue-400 p-1 transition-colors"
                            title="Open in GitHub"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <HiSolidArrowTopRightOnSquare class="w-3 h-3" />
                          </a>
                          <button
                            onClick={(e) => handleDelete(repo, e)}
                            class="text-gray-400 hover:text-red-400 p-1 transition-colors"
                            title="Delete repository"
                          >
                            <HiSolidTrash class="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
