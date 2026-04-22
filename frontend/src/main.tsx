import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { BrandingProvider } from "./branding/BrandingProvider";
import { ToastProvider } from "./components/ToastProvider";
import { TooltipProvider } from "@/components/shadcn/tooltip";
import { ThemeProvider } from "./theme";
import App from "./App";
import "./styles/tailwind.css";
import "./index-legacy.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <BrandingProvider>
              <TooltipProvider delayDuration={200}>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </TooltipProvider>
            </BrandingProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
  </React.StrictMode>,
);
