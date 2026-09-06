import { createContext, useContext } from "react";

import { initialOnboardingSteps, TOTAL_STEPS_COUNT } from "./initialOnboardingState";
import {
  OnboardingContextType,
  OnboardingProviderProps,
  OnboardingState,
  OnboardingStepsIDs,
} from "./types";

const OnboardingContext = createContext<OnboardingContextType | null>(null);

/** Онбординг отключён для Vspomni — провайдер оставлен для совместимости с useOnboarding. */
const disabledOnboardingState: OnboardingState = {
  onboardingExpanded: false,
  stepsCompleted: initialOnboardingSteps.map(step => step.id),
  stepsExpanded: {} as OnboardingState["stepsExpanded"],
};

export const OnboardingProvider = ({ children }: OnboardingProviderProps) => {
  const noop = () => undefined;

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingCompleted: true,
        onboardingState: disabledOnboardingState,
        extendedStepId: "" as OnboardingStepsIDs | "",
        loading: false,
        markOnboardingStepAsCompleted: noop,
        markAllAsCompleted: noop,
        toggleExpandedOnboardingStep: noop,
        toggleOnboarding: noop,
        validCompletedStepsCount: TOTAL_STEPS_COUNT,
        visibleSteps: initialOnboardingSteps,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);

  if (context === null) {
    throw new Error("useOnboarding must be used within a OnboardingProvider");
  }

  return context;
};
