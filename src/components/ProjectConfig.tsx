import { createSignal } from "solid-js";
import type { Project, ProjectConfigProps } from "~/types";

export default function ProjectConfig(props: ProjectConfigProps) {
  const [name, setName] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!name()) return;

    setIsLoading(true);

    // Create a new project
    const newProject: Project = {
      id: name().toLowerCase().replace(/\s+/g, "-"),
      name: name(),
      issues: [],
    };

    props.onAddProject(newProject);
    setName("");
    setIsLoading(false);
    props.onClose();
  };

  return (
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h2 class="text-xl font-bold mb-4 text-white">Add Custom Column</h2>

        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Column Name
            </label>
            <input
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="e.g., Testing, Staging, Deployed"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p class="text-xs text-gray-400 mt-1">
              This will create a new column in your Kanban board. GitHub issues
              are auto-categorized.
            </p>
          </div>

          <div class="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading() || !name()}
              class="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading() ? "Creating..." : "Create Column"}
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
