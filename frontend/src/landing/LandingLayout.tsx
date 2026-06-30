import { Outlet } from "react-router-dom";
import { LandingHeader } from "./components/LandingHeader";
import { LandingFooter } from "./components/LandingFooter";

export function LandingLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader />
      <div className="flex-1">
        <Outlet />
      </div>
      <LandingFooter />
    </div>
  );
}
