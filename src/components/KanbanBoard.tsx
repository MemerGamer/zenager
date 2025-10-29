import { For, createSignal, Show } from "solid-js";
import {
  DragDropProvider,
  DragDropSensors,
  useDragDropContext,
  createDraggable,
  createDroppable,
} from "@thisbeyond/solid-dnd";
import KanbanColumn from "~/components/KanbanColumn";
import type { Project, Issue } from "~/routes/kanban";

// Drop zone component for column reordering
function DropZone(props: { projectId: string }) {
  const droppable = createDroppable(`after-${props.projectId}`);

  return (
    <div
      use:droppable
      class="w-8 bg-transparent hover:bg-orange-500 transition-colors rounded flex items-center justify-center"
    >
      <div class="w-1 h-8 bg-orange-500 opacity-0 hover:opacity-100 transition-opacity rounded"></div>
    </div>
  );
}

interface KanbanBoardProps {
  projects: Project[];
  onUpdateProject: (projectId: string, issues: Issue[]) => void;
  onReorderProjects: (reorderedProjects: Project[]) => void;
  visibleColumns: string[];
  onAddCustomItem?: (projectId: string) => void;
  isEditMode: boolean;
}

declare module "solid-js" {
  namespace JSX {
    interface Directives {
      draggable: any;
      droppable: any;
    }
  }
}

function KanbanBoardContent(props: KanbanBoardProps) {
  const context = useDragDropContext();
  if (!context) return null;

  const [, { onDragEnd }] = context;

  onDragEnd((event: any) => {
    const { draggable, droppable } = event;
    if (!draggable || !droppable) return;

    const draggableId = draggable.id;
    const droppableId = droppable.id;

    if (draggableId.startsWith("column-")) {
      if (!props.isEditMode) return;

      const sourceColumnId = draggableId.replace("column-", "");
      const sourceIndex = props.projects.findIndex(
        (p) => p.id === sourceColumnId
      );
      if (sourceIndex === -1) return;

      let targetIndex = sourceIndex;

      const foundTargetIndex = props.projects.findIndex(
        (p) => p.id === droppableId
      );
      if (foundTargetIndex !== -1) {
        targetIndex = foundTargetIndex;
      }

      if (droppableId.startsWith("after-")) {
        const afterColumnId = droppableId.replace("after-", "");
        const afterIndex = props.projects.findIndex(
          (p) => p.id === afterColumnId
        );
        if (afterIndex !== -1) {
          targetIndex = afterIndex + 1;
        }
      }

      if (sourceIndex === targetIndex) return;

      const reorderedProjects = [...props.projects];
      const [movedProject] = reorderedProjects.splice(sourceIndex, 1);
      reorderedProjects.splice(targetIndex, 0, movedProject);

      props.onReorderProjects(reorderedProjects);
      return;
    }

    const targetProjectId = droppableId;

    let issue: any = null;
    let sourceProjectId = "";

    for (const project of props.projects) {
      const foundIssue = project.issues.find(
        (i) => i.id.toString() === draggableId
      );
      if (foundIssue) {
        issue = foundIssue;
        sourceProjectId = project.id;
        break;
      }
    }

    if (!issue) return;

    if (sourceProjectId === targetProjectId) {
      const project = props.projects.find((p) => p.id === sourceProjectId);
      if (!project) return;

      const sourceIndex = project.issues.findIndex((i) => i.id === issue.id);
      if (sourceIndex === -1) return;

      const reorderedIssues = [...project.issues];
      const [movedIssue] = reorderedIssues.splice(sourceIndex, 1);

      let targetIndex;
      if (sourceIndex === project.issues.length - 1) {
        targetIndex = Math.max(sourceIndex - 1, 0);
      } else if (sourceIndex % 2 === 0) {
        targetIndex = Math.min(sourceIndex + 1, project.issues.length - 1);
      } else {
        targetIndex = Math.max(sourceIndex - 1, 0);
      }

      reorderedIssues.splice(targetIndex, 0, movedIssue);
      props.onUpdateProject(sourceProjectId, reorderedIssues);
      return;
    }

    const sourceProject = props.projects.find((p) => p.id === sourceProjectId);
    if (!sourceProject) return;

    const updatedSourceIssues = sourceProject.issues.filter(
      (i) => i.id !== issue.id
    );
    props.onUpdateProject(sourceProjectId, updatedSourceIssues);

    const targetProject = props.projects.find((p) => p.id === targetProjectId);
    if (!targetProject) return;

    const updatedTargetIssues = [...targetProject.issues, issue];
    props.onUpdateProject(targetProjectId, updatedTargetIssues);
  });

  return (
    <div class="flex gap-6 overflow-x-auto pb-4">
      <For each={props.projects}>
        {(project, index) => {
          const columnDroppable = createDroppable(`column-${project.id}`);
          return (
            <>
              <KanbanColumn
                project={project}
                isCollapsible={project.id === "done"}
                defaultCollapsed={project.id === "done"}
                onAddCustomItem={props.onAddCustomItem}
                isEditMode={props.isEditMode}
              />
              <Show
                when={props.isEditMode && index() < props.projects.length - 1}
              >
                <DropZone projectId={project.id} />
              </Show>
            </>
          );
        }}
      </For>
    </div>
  );
}

export default function KanbanBoard(props: KanbanBoardProps) {
  return (
    <DragDropProvider>
      <DragDropSensors>
        <KanbanBoardContent {...props} />
      </DragDropSensors>
    </DragDropProvider>
  );
}
