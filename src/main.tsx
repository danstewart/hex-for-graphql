import React from "react";
import ReactDOM from "react-dom/client";
import { loader } from "@monaco-editor/react";
import * as monacoEditor from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import GraphQLWorker from "monaco-graphql/esm/graphql.worker?worker";
import { initGraphQLMode } from "./lib/schema";
import App from "./App";
import "./index.css";

// Use locally bundled Monaco instead of CDN (required in Tauri's webview).
loader.config({ monaco: monacoEditor });

// Route Monaco web worker requests to our bundled worker chunks.
// Must be set before initGraphQLMode() so the graphql worker resolves correctly.
(window as unknown as Record<string, unknown>).MonacoEnvironment = {
  getWorker(_: string, label: string): Worker {
    if (label === "graphql") return new GraphQLWorker();
    if (label === "json") return new JsonWorker();
    return new EditorWorker();
  },
};

// Register the GraphQL language service before any editor mounts.
// Doing this at module load time (not inside onMount) avoids a race where
// the editor starts without the graphql worker registered.
initGraphQLMode();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
