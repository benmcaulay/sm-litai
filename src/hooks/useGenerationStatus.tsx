import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type GenerationStatusState = {
  isGenerating: boolean;
  steps: string[];
  setIsGenerating: (value: boolean) => void;
  reset: () => void;
  addStep: (step: string) => void;
};

const GenerationStatusContext = createContext<GenerationStatusState | undefined>(undefined);

export const GenerationStatusProvider = ({ children }: { children: ReactNode }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);

  const reset = useCallback(() => setSteps([]), []);
  const addStep = useCallback((step: string) => setSteps((prev) => [...prev, step]), []);

  const value: GenerationStatusState = {
    isGenerating,
    steps,
    setIsGenerating,
    reset,
    addStep,
  };

  return (
    <GenerationStatusContext.Provider value={value}>
      {children}
    </GenerationStatusContext.Provider>
  );
};

export const useGenerationStatus = () => {
  const ctx = useContext(GenerationStatusContext);
  if (!ctx) throw new Error("useGenerationStatus must be used within GenerationStatusProvider");
  return ctx;
};
