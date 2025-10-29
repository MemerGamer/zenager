import { A } from "@solidjs/router";
import { HiSolidExclamationTriangle } from "solid-icons/hi";

export default function NotFound() {
  return (
    <div class="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div class="text-center">
        <div class="mb-8">
          <HiSolidExclamationTriangle class="w-24 h-24 text-yellow-500 mx-auto mb-4" />
          <h1 class="text-6xl font-bold text-white mb-4">404</h1>
          <h2 class="text-2xl font-semibold text-gray-300 mb-2">
            Page Not Found
          </h2>
          <p class="text-gray-400 mb-8 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div class="space-y-4">
          <A
            href="/kanban"
            class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            Go to Zenager
          </A>
        </div>
      </div>
    </div>
  );
}
