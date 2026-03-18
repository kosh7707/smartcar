import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

interface AnalysisGuardState {
  isBlocking: boolean;
}

interface AnalysisGuardActions {
  setBlocking: (blocking: boolean) => void;
}

const GuardStateContext = createContext<AnalysisGuardState>({ isBlocking: false });
const GuardActionsContext = createContext<AnalysisGuardActions>({ setBlocking: () => {} });

export const AnalysisGuardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBlocking, setIsBlocking] = useState(false);

  const state = useMemo(() => ({ isBlocking }), [isBlocking]);
  const actions = useMemo<AnalysisGuardActions>(() => ({
    setBlocking: (b: boolean) => setIsBlocking(b),
  }), []);

  return (
    <GuardStateContext.Provider value={state}>
      <GuardActionsContext.Provider value={actions}>
        {children}
      </GuardActionsContext.Provider>
    </GuardStateContext.Provider>
  );
};

export function useAnalysisGuard(): AnalysisGuardState {
  return useContext(GuardStateContext);
}

export function useSetAnalysisGuard(): AnalysisGuardActions {
  return useContext(GuardActionsContext);
}
