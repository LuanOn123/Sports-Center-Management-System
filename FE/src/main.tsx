import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./shared/detail.css";
import "./shared/design-system.css";
import "./shared/portal-theme.css";
import App from "./app/App";

const googleClientId =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_GOOGLE_CLIENT_ID || "demo-google-client-id.apps.googleusercontent.com";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>,
);
