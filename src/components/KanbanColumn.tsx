import { For, createSignal, Show } from "solid-js";
import { createDroppable, createDraggable } from "@thisbeyond/solid-dnd";
import KanbanCard from "~/components/KanbanCard";
import type { Project } from "~/routes/kanban";

declare module "solid-js" {
  namespace JSX {
    interface Directives {
      droppable: any;
      draggable: any;
    }
  }
}

interface KanbanColumnProps {
  project: Project;
  isCollapsible?: boolean;
  defaultCollapsed?: boolean;
  onAddCustomItem?: (projectId: string) => void;
  isEditMode?: boolean;
}

export default function KanbanColumn(props: KanbanColumnProps) {
  const droppable = createDroppable(props.project.id);
  const [isCollapsed, setIsCollapsed] = createSignal(
    props.defaultCollapsed || false
  );

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed());
  };

  return (
    <Show
      when={props.isEditMode}
      fallback={
        <div
          use:droppable
          class="min-w-80 bg-gray-800 rounded-lg p-4 transition-colors"
        >
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-semibold text-white">
                {props.project.name}
              </h3>
              <Show when={props.isCollapsible}>
                <button
                  onClick={toggleCollapsed}
                  class="text-gray-400 hover:text-white transition-colors"
                >
                  {isCollapsed() ? "▼" : "▲"}
                </button>
              </Show>
            </div>
            <span class="bg-gray-700 text-gray-300 px-2 py-1 rounded-full text-sm">
              {props.project.issues.length}
            </span>
          </div>

          <Show when={!isCollapsed()}>
            <div class="space-y-3 min-h-96">
              <For each={props.project.issues}>
                {(issue) => (
                  <KanbanCard
                    issue={issue}
                    projectId={props.project.id}
                    isEditMode={props.isEditMode}
                  />
                )}
              </For>

              <Show when={props.onAddCustomItem}>
                <button
                  onClick={() => props.onAddCustomItem?.(props.project.id)}
                  class="w-full p-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-2"
                >
                  <span>+</span>
                  <span>Add Item</span>
                </button>
              </Show>
            </div>
          </Show>

          <Show when={isCollapsed() && props.project.issues.length > 0}>
            <div class="text-center py-4 text-gray-400 text-sm">
              {props.project.issues.length} issues hidden
            </div>
          </Show>
        </div>
      }
    >
      {(() => {
        const draggable = createDraggable(`column-${props.project.id}`);
        return (
          <div
            use:draggable
            use:droppable
            class="min-w-80 bg-gray-800 rounded-lg p-4 transition-colors cursor-move hover:bg-gray-700 border-2 border-dashed border-orange-500"
          >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <h3 class="text-lg font-semibold text-white">
              {props.project.name}
            </h3>
            <Show when={props.isCollapsible}>
              <button
                onClick={toggleCollapsed}
                class="text-gray-400 hover:text-white transition-colors"
              >
                {isCollapsed() ? "▼" : "▲"}
              </button>
            </Show>
          </div>
          <span class="bg-gray-700 text-gray-300 px-2 py-1 rounded-full text-sm">
            {props.project.issues.length}
          </span>
        </div>

        <Show when={!isCollapsed()}>
          <div class="space-y-3 min-h-96">
            <For each={props.project.issues}>
              {(issue) => (
                <KanbanCard
                  issue={issue}
                  projectId={props.project.id}
                  isEditMode={props.isEditMode}
                />
              )}
            </For>

            <Show when={props.onAddCustomItem}>
              <button
                onClick={() => props.onAddCustomItem?.(props.project.id)}
                class="w-full p-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-2"
              >
                <span>+</span>
                <span>Add Item</span>
              </button>
            </Show>
          </div>
        </Show>

          <Show when={isCollapsed() && props.project.issues.length > 0}>
            <div class="text-center py-4 text-gray-400 text-sm">
              {props.project.issues.length} issues hidden
            </div>
          </Show>
        </div>
        );
      })()}
    </Show>
  );
}
