import { lazy, Suspense } from "react";
import "./ai.css";
const MarkdownRenderer = lazy(() => import("./AIMarkdownRenderer"));

export function AIMarkdown({ children }: { children: string }) {
  return (
    <div className="ai-markdown">
      <Suspense fallback={<p>{children}</p>}>
        <MarkdownRenderer>{children}</MarkdownRenderer>
      </Suspense>
    </div>
  );
}
