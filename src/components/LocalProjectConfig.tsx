import { createSignal, Show } from "solid-js";
import type { LocalProjectConfigProps } from "~/types";
import { createLocalRepo } from "~/utils/projectState";

export default function LocalProjectConfig(props: LocalProjectConfigProps) {
  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [error, setError] = createSignal("");

  const handleSubmit = (e: Event) => {
    e.preventDefault();

    const result = createLocalRepo(
      props.existingRepositories,
      name(),
      description()
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }

    props.onAddRepository(result.repo);
    props.onClose();
  };

  return (
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h2 class="text-xl font-bold mb-4 text-white">Add Local Project</h2>

        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={name()}
              onInput={(e) => {
                setName(e.currentTarget.value);
                setError("");
              }}
              placeholder="e.g., Personal Tasks"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <Show when={error()}>
              <p class="text-xs text-red-400 mt-1">{error()}</p>
            </Show>
            <p class="text-xs text-gray-400 mt-1">
              A local project is not linked to GitHub or GitLab. Add cards to it
              with the + button on any column; they are stored in this browser.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              placeholder="What is this project about?"
              rows={3}
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div class="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={!name().trim()}
              class="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors"
            >
              Create Project
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
