import { AIChatBubble } from "../features/ai/AIChatBubble";
import { BrowserRouter, useLocation } from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { authService, hasSession } from "../shared/api";
import { Session } from "../features/auth/Session";
import "../styles.css";
import "../shared/loading-theme.css";
import { ErrorBoundary } from "../shared/ErrorBoundary";
import { ToastViewport } from "../shared/toast";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});
export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <Session />
          <SessionChat />
          <ToastViewport />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function SessionChat() {
  // Recheck session identity on navigation, including logout redirects.
  const location = useLocation();
  const profile = useQuery({
    queryKey: ["me"],
    queryFn: authService.me,
    enabled: false,
  });
  if (
    hasSession() &&
    /^\/(member|admin|manager|coach|receptionist)(\/|$)/.test(location.pathname)
  )
    return null;
  return (
    <AIChatBubble
      key={hasSession() ? profile.data?.data.id || "loading" : "anonymous"}
    />
  );
}
