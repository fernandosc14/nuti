import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WelcomeScreen } from "@/components/onboarding/WelcomeScreen";
import { OnboardingStep } from "@/components/onboarding/OnboardingStep";
import { GenderStep } from "@/components/onboarding/GenderStep";
import { WorkoutStep } from "@/components/onboarding/WorkoutStep";
import { SourceStep } from "@/components/onboarding/SourceStep";
import { PreviousAppStep } from "@/components/onboarding/PreviousAppStep";
import { ResultsStep } from "@/components/onboarding/ResultsStep";

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    gender: null as string | null,
    workoutFrequency: null as string | null,
    source: null as string | null,
    previousApp: null as string | null,
  });

  const handleGetStarted = () => {
    setStep(1);
  };

  const handleSignIn = () => {
    navigate("/");
  };

  const handleContinue = () => {
    if (step === 5) {
      // Last step - complete onboarding
      navigate("/");
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      setStep(0);
    } else {
      setStep(step - 1);
    }
  };

  if (step === 0) {
    return (
      <WelcomeScreen
        onGetStarted={handleGetStarted}
        onSignIn={handleSignIn}
      />
    );
  }

  const totalSteps = 5;

  return (
    <>
      {step === 1 && (
        <OnboardingStep
          title="Choose your Gender"
          subtitle="This will be used to calibrate your custom plan."
          currentStep={1}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
          canContinue={data.gender !== null}
        >
          <GenderStep
            selected={data.gender}
            onSelect={(gender) => setData({ ...data, gender })}
          />
        </OnboardingStep>
      )}

      {step === 2 && (
        <OnboardingStep
          title="How many workouts do you do per week?"
          subtitle="This will be used to calibrate your custom plan."
          currentStep={2}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
          canContinue={data.workoutFrequency !== null}
        >
          <WorkoutStep
            selected={data.workoutFrequency}
            onSelect={(frequency) => setData({ ...data, workoutFrequency: frequency })}
          />
        </OnboardingStep>
      )}

      {step === 3 && (
        <OnboardingStep
          title="Where did you hear about us?"
          currentStep={3}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
          canContinue={data.source !== null}
        >
          <SourceStep
            selected={data.source}
            onSelect={(source) => setData({ ...data, source })}
          />
        </OnboardingStep>
      )}

      {step === 4 && (
        <OnboardingStep
          title="Have you tried other calorie tracking apps?"
          currentStep={4}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
          canContinue={data.previousApp !== null}
        >
          <PreviousAppStep
            selected={data.previousApp}
            onSelect={(answer) => setData({ ...data, previousApp: answer })}
          />
        </OnboardingStep>
      )}

      {step === 5 && (
        <OnboardingStep
          title="NutriMate cria resultados duradouros"
          currentStep={5}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
        >
          <ResultsStep />
        </OnboardingStep>
      )}
    </>
  );
};

export default Onboarding;
