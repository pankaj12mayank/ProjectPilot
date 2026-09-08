import { useEffect, useState } from "react";
import { createContext, useContext } from "react";

type Ctx = {
  show: (msg?: string) => void;
  hide: () => void;
};

const LoaderCtx = createContext<Ctx>({ show: () => {}, hide: () => {} });

let _show: (msg?: string) => void = () => {};
let _hide: () => void = () => {};

export function useGlobalLoader() {
  return useContext(LoaderCtx);
}

// For non-React callers (api client, page switch)
export const globalLoader = {
  show: (msg?: string) => _show(msg),
  hide: () => _hide(),
};

export function GlobalAILoaderProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [msg, setMsg] = useState("Loading…");
  const show = (m?: string) => {
    setMsg(m || "Loading…");
    setVisible(true);
  };
  const hide = () => setVisible(false);
  _show = show;
  _hide = hide;

  useEffect(() => {
    const onRoute = () => show("Switching…");
    window.addEventListener("pp:route-loading", onRoute as EventListener);
    return () => window.removeEventListener("pp:route-loading", onRoute as EventListener);
  }, []);

  return (
    <LoaderCtx.Provider value={{ show, hide }}>
      {children}
      {visible ? (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-5 py-3 shadow-soft">
            <span className="size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
            <span className="font-display text-sm font-medium text-foreground">{msg}</span>
          </div>
        </div>
      ) : null}
    </LoaderCtx.Provider>
  );
}
