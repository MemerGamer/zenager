// Core domain types
export interface Issue {
  id: number;
  title: string;
  body: string;
  state: "open" | "closed";
  labels: Array<{ name: string; color: string }>;
  assignee?: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  html_url: string;
  isCustom?: boolean; // Flag to identify custom (non-GitHub) items
}

export interface Project {
  id: string;
  name: string;
  issues: Issue[];
}

export interface GitHubRepo {
  type: "github";
  owner: string;
  repo: string;
  author?: string;
  url?: string;
}

export interface GitLabRepo {
  type: "gitlab";
  domain: string;
  projectPath: string;
  url?: string;
}

export type Repo = GitHubRepo | GitLabRepo;

// Component prop types
export interface GitHubConfigProps {
  onAddRepository: (repo: GitHubRepo) => void;
  onClose: () => void;
  githubApiKey: string;
  onApiKeyChange: (key: string) => void;
}

export interface GitLabConfigProps {
  onAddRepository: (repo: GitLabRepo) => void;
  onClose: () => void;
  gitlabApiKey: string;
  onApiKeyChange: (key: string) => void;
}

export interface RepositoryDropdownProps {
  repositories: Repo[];
  selectedRepositories: string[];
  onToggleRepository: (repoId: string) => void;
  onDeleteRepository: (repoId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

export interface KanbanBoardProps {
  projects: Project[];
  onUpdateProject: (projectId: string, issues: Issue[]) => void;
  onReorderProjects: (reorderedProjects: Project[]) => void;
  visibleColumns: string[];
  onAddCustomItem?: (projectId: string) => void;
  isEditMode: boolean;
}

export interface KanbanCardProps {
  issue: Issue;
  projectId: string;
  isEditMode?: boolean;
}

export interface KanbanColumnProps {
  project: Project;
  isCollapsible?: boolean;
  defaultCollapsed?: boolean;
  onAddCustomItem?: (projectId: string) => void;
  isEditMode?: boolean;
}

export interface ProjectConfigProps {
  onAddProject: (project: Project) => void;
  onClose: () => void;
}

export interface CustomItemCreatorProps {
  projectId: string;
  onAddItem: (projectId: string, item: Issue) => void;
  onClose: () => void;
}

export interface ColumnManagerProps {
  projects: Project[];
  visibleColumns: string[];
  onToggleColumn: (columnId: string) => void;
  onClose: () => void;
}

// Utility types
export interface DefaultColumn {
  id: string;
  name: string;
}
