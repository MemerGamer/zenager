import { For, Show } from "solid-js";
import type { Project } from "~/routes/kanban";

interface ColumnManagerProps {
  projects: Project[];
  visibleColumns: string[];
  onToggleColumn: (columnId: string) => void;
  onClose: () => void;
}

export default function ColumnManager(props: ColumnManagerProps) {
  const isVisible = (columnId: string) =>
    props.visibleColumns.includes(columnId);

  return (
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h2 class="text-xl font-bold mb-4 text-white">Manage Columns</h2>

        <div class="space-y-3">
          <For each={props.projects}>
            {(project) => (
              <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <div class="flex items-center gap-3">
                  <div
                    class={`w-3 h-3 rounded-full ${
                      isVisible(project.id) ? "bg-green-500" : "bg-gray-500"
                    }`}
                  />
                  <span class="text-white font-medium">{project.name}</span>
                  <span class="text-gray-400 text-sm">
                    ({project.issues.length} issues)
                  </span>
                </div>
                <button
                  onClick={() => props.onToggleColumn(project.id)}
                  class={`px-3 py-1 rounded text-sm transition-colors ${
                    isVisible(project.id)
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                  }`}
                >
                  {isVisible(project.id) ? "Visible" : "Hidden"}
                </button>
              </div>
            )}
          </For>
        </div>

        <div class="flex gap-3 pt-6">
          <button
            onClick={props.onClose}
            class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
