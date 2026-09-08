import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { globalLoader } from "@/components/GlobalAILoader";

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  useEffect(() => {
    globalLoader.show("Switching…");
    const t = window.setTimeout(() => globalLoader.hide(), 320);
    return () => window.clearTimeout(t);
  }, [location.pathname]);
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-0 flex-1"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
