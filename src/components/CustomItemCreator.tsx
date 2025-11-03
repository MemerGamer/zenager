import { createSignal, Show } from "solid-js";
import type { Issue, CustomItemCreatorProps } from "~/types";

export default function CustomItemCreator(props: CustomItemCreatorProps) {
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!title()) return;

    setIsLoading(true);

    const customIssue: Issue = {
      id: Date.now(),
      title: title(),
      body: description(),
      state: "open",
      labels: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      html_url: "",
      isCustom: true,
    };

    props.onAddItem(props.projectId, customIssue);

    setTitle("");
    setDescription("");
    setIsLoading(false);
    props.onClose();
  };

  return (
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h2 class="text-xl font-bold mb-4 text-white">Add Custom Item</h2>

        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Title
            </label>
            <input
              type="text"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
              placeholder="Enter item title"
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              placeholder="Enter item description"
              rows={3}
              class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div class="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading() || !title()}
              class="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading() ? "Adding..." : "Add Item"}
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
