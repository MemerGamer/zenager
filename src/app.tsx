import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import { MetaProvider, Title, Meta } from "@solidjs/meta";
import Nav from "~/components/Nav";
import "./app.css";

export default function App() {
  return (
    <MetaProvider>
      <Title>Zenager</Title>
      <Meta name="description" content="Kanban board for project management with GitHub Integration" />
      <Meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      <Router
        root={(props) => (
          <>
            <Nav />
            <Suspense>{props.children}</Suspense>
          </>
        )}
      >
        <FileRoutes />
      </Router>
    </MetaProvider>
  );
}
