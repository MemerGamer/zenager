import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import type { Project, Repo } from "~/types";
import { computeTimeline } from "~/utils/gantt";

const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export default function Gantt() {
  // Same persisted state the kanban board reads and writes
  const [projects] = makePersisted(createSignal<Project[]>([]), {
    name: "zenager-projects",
  });
  const [repositories] = makePersisted(createSignal<Repo[]>([]), {
    name: "zenager-repositories",
  });
  // Avoid SSR/client mismatch: `now` and localStorage are client-only
  const [now, setNow] = createSignal<number>();
  onMount(() => setNow(Date.now()));

  const timeline = createMemo(() => {
    const n = now();
    return n === undefined
      ? undefined
      : computeTimeline(projects(), repositories(), n);
  });

  return (
    <main class="container mx-auto px-4 py-6 text-gray-200">
      <h1 class="text-2xl font-bold text-white mb-1">Gantt overview</h1>
      <p class="text-sm text-gray-400 mb-6">
        Each bar runs from an issue's creation date to its close date. Open
        issues extend to today.
      </p>
      <Show
        when={timeline()}
        fallback={
          <p class="text-gray-400">
            {now() === undefined
              ? "Loading..."
              : "No issues with dates to show. Add a repository on the Kanban page first."}
          </p>
        }
      >
        {(t) => (
          <div class="overflow-x-auto">
            <div class="min-w-[800px]">
              <div class="flex">
                <div class="w-56 shrink-0" />
                <div class="relative flex-1 h-6 border-b border-gray-700">
                  <For each={t().ticks}>
                    {(tick) => (
                      <span
                        class="absolute text-xs text-gray-400 whitespace-nowrap"
                        style={{ left: `${tick.left}%` }}
                      >
                        {tick.label}
                      </span>
                    )}
                  </For>
                </div>
              </div>
              <For each={t().groups}>
                {(group) => (
                  <section class="mt-4">
                    <h2 class="font-semibold text-white mb-1">{group.name}</h2>
                    <For each={group.rows}>
                      {(row) => {
                        const label = `${row.title} (${fmt(row.start)} - ${
                          row.state === "open" ? "open" : fmt(row.end)
                        })`;
                        return (
                          <div class="flex items-center h-6 hover:bg-gray-800">
                            <div
                              class="w-56 shrink-0 truncate pr-2 text-sm"
                              title={row.title}
                            >
                              {row.title}
                            </div>
                            <div class="relative flex-1 h-full">
                              <For each={t().ticks}>
                                {(tick) => (
                                  <div
                                    class="absolute top-0 bottom-0 border-l border-gray-800"
                                    style={{ left: `${tick.left}%` }}
                                  />
                                )}
                              </For>
                              {(() => {
                                const cls = `absolute top-1 bottom-1 rounded ${
                                  row.state === "open"
                                    ? "bg-blue-500"
                                    : "bg-green-600"
                                }`;
                                const style = {
                                  left: `${row.left}%`,
                                  width: `${row.width}%`,
                                };
                                return row.url ? (
                                  <a
                                    href={row.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class={cls}
                                    style={style}
                                    title={label}
                                  />
                                ) : (
                                  <div
                                    class={cls}
                                    style={style}
                                    title={label}
                                  />
                                );
                              })()}
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </section>
                )}
              </For>
            </div>
          </div>
        )}
      </Show>
    </main>
  );
}
