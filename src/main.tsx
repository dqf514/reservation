import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/noto-sans-sc/700.css";
import "@fontsource/noto-serif-sc/600.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { i18n } from "@/i18n";
import { SplashGate } from "@/components/SplashGate";
import { AuthProvider } from "@/context/AuthContext";
import { BrandingProvider } from "@/context/BrandingContext";
import { OperatingPeriodsProvider } from "@/context/OperatingPeriodsContext";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <BrandingProvider>
          <OperatingPeriodsProvider>
            {/* Auth 必须在 SplashGate 外侧：启动页全屏时若卸载 AuthProvider 会丢失已登录态 */}
            <AuthProvider>
              <SplashGate>
                <App />
              </SplashGate>
            </AuthProvider>
          </OperatingPeriodsProvider>
        </BrandingProvider>
      </BrowserRouter>
    </I18nextProvider>
  </StrictMode>,
);
