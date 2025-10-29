import { For, Show } from "solid-js";
import { createDraggable } from "@thisbeyond/solid-dnd";
import type { Issue } from "~/routes/kanban";

declare module "solid-js" {
  namespace JSX {
    interface Directives {
      draggable: any;
    }
  }
}

interface KanbanCardProps {
  issue: Issue;
  projectId: string;
  isEditMode?: boolean;
}

export default function KanbanCard(props: KanbanCardProps) {
  const isEditMode = props.isEditMode ?? false;
  const draggable = createDraggable(props.issue.id.toString());

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStateColor = (state: string) => {
    return state === "open" ? "bg-green-500" : "bg-red-500";
  };

  return (
    <div
      use:draggable
      class={`bg-gray-700 hover:bg-gray-600 rounded-lg p-4 transition-colors border border-gray-600 ${
        isEditMode ? "cursor-default" : "cursor-move"
      }`}
      style={`pointer-events: ${isEditMode ? "none" : "auto"}`}
      title={`Edit mode: ${isEditMode}, Draggable: ${!isEditMode}`}
    >
      <div class="flex items-start justify-between mb-2">
        <h4 class="text-white font-medium text-sm leading-tight flex-1 mr-2">
          {props.issue.title}
        </h4>
        <div
          class={`w-2 h-2 rounded-full ${getStateColor(
            props.issue.state
          )} flex-shrink-0`}
        />
      </div>

      <Show when={props.issue.body}>
        <p class="text-gray-300 text-xs mb-3 line-clamp-3">
          {props.issue.body.substring(0, 100)}
          {props.issue.body.length > 100 && "..."}
        </p>
      </Show>

      <Show when={props.issue.labels.length > 0}>
        <div class="flex flex-wrap gap-1 mb-3">
          <For each={props.issue.labels}>
            {(label) => (
              <span
                class="px-2 py-1 rounded-full text-xs font-medium"
                style={`background-color: #${
                  label.color
                }; color: ${getContrastColor(label.color)}`}
              >
                {label.name}
              </span>
            )}
          </For>
        </div>
      </Show>

      <div class="flex items-center justify-between text-xs text-gray-400">
        <div class="flex items-center gap-2">
          <Show when={props.issue.assignee}>
            <div class="flex items-center gap-1">
              <img
                src={props.issue.assignee!.avatar_url}
                alt={props.issue.assignee!.login}
                class="w-4 h-4 rounded-full"
              />
              <span>{props.issue.assignee!.login}</span>
            </div>
          </Show>
        </div>
        <span>{formatDate(props.issue.created_at)}</span>
      </div>

      <Show when={!props.issue.isCustom && props.issue.html_url}>
        <div class="mt-3">
          <a
            href={props.issue.html_url}
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-400 hover:text-blue-300 text-xs"
          >
            View on GitHub →
          </a>
        </div>
      </Show>

      <Show when={props.issue.isCustom}>
        <div class="mt-3">
          <span class="text-gray-500 text-xs">Custom Item</span>
        </div>
      </Show>
    </div>
  );
}

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? "#000000" : "#ffffff";
}
