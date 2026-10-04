import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export default function AIMarkdownRenderer({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{ img: ({ alt }) => <span>{alt}</span> }}
    >
      {children}
    </ReactMarkdown>
  );
}
