import { useLocation } from "@solidjs/router";

export default function Nav() {
  const location = useLocation();
  const active = (path: string) =>
    path == location.pathname
      ? "text-blue-400"
      : "text-gray-300 hover:text-white";

  return (
    <nav class="bg-gray-900 border-b border-gray-700">
      <div class="container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-8">
            <a
              href="/kanban"
              class="text-xl font-bold text-white hover:text-blue-400 transition-colors"
            >
              Zenager
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
