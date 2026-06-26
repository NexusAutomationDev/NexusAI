import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen"; // TanStack Router generated
import { runMigrations } from "./lib/db/proxy";
import "./index.css";

// Apply dark mode default immediately (D-02) — before React renders
// Overridden by appearance store load in Plan 04
document.documentElement.classList.add("dark");
document.documentElement.setAttribute("data-accent", "violet");

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

async function main() {
  // Run DB migrations before mounting React (FOUND-06)
  await runMigrations();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
}

main().catch(console.error);
