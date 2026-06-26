import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen"; // TanStack Router generated
import { runMigrations } from "./lib/db/proxy";
import { useAppearance } from "./lib/stores/appearance";
import "./index.css";

const router = createRouter({ routeTree });
const queryClient = new QueryClient();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

async function main() {
  // Restore persisted theme/accent/font-scale before React renders (D-09)
  // Falls back to dark theme + violet accent if no persisted preference (D-02)
  const { load: loadAppearance } = useAppearance.getState();
  await loadAppearance();

  // Run DB migrations before mounting React (FOUND-06)
  await runMigrations();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </React.StrictMode>
  );
}

main().catch(console.error);
