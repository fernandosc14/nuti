import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WelcomeScreen } from "@/components/onboarding/WelcomeScreen";
import { OnboardingStep } from "@/components/onboarding/OnboardingStep";
import { GenderStep } from "@/components/onboarding/GenderStep";
import { WorkoutStep } from "@/components/onboarding/WorkoutStep";
import { SourceStep } from "@/components/onboarding/SourceStep";
import { PreviousAppStep } from "@/components/onboarding/PreviousAppStep";
import { ResultsStep } from "@/components/onboarding/ResultsStep";
import { HeightWeightStep } from "@/components/onboarding/HeightWeightStep";
import { BirthdateStep } from "@/components/onboarding/BirthdateStep";
import { GoalStep } from "@/components/onboarding/GoalStep";
import { TargetWeightStep } from "@/components/onboarding/TargetWeightStep";
import { GoalFeedbackStep } from "@/components/onboarding/GoalFeedbackStep";
import { SpeedStep } from "@/components/onboarding/SpeedStep";
import { ComparisonStep } from "@/components/onboarding/ComparisonStep";
import { ObstaclesStep } from "@/components/onboarding/ObstaclesStep";
import { DietStep } from "@/components/onboarding/DietStep";
import { AccomplishStep } from "@/components/onboarding/AccomplishStep";
import { PotentialStep } from "@/components/onboarding/PotentialStep";
import { FinalLoadingStep } from "@/components/onboarding/FinalLoadingStep";
import { Button } from "@/components/ui/button";

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    gender: null as string | null,
    workoutFrequency: null as string | null,
    source: null as string | null,
    previousApp: null as string | null,
    height: "",
    weight: "",
    isMetric: true,
    birthMonth: "",
    birthYear: "",
    goal: null as string | null,
    targetWeight: 75,
    speed: null as string | null,
    obstacles: [] as string[],
    diet: null as string | null,
    accomplishments: [] as string[],
  });

  const handleGetStarted = () => {
    setStep(1);
  };

  const handleSignIn = () => {
    navigate("/");
  };

  const handleContinue = () => {
    if (step === 18) {
      // Last step - complete onboarding (after 3 second delay on loading screen)
      setTimeout(() => {
        navigate("/");
      }, 3000);
    }
    setStep(step + 1);
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

  const totalSteps = 17;

  const toggleArrayItem = (array: string[], item: string) => {
    if (array.includes(item)) {
      return array.filter((i) => i !== item);
    }
    return [...array, item];
  };

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

      {step === 6 && (
        <OnboardingStep
          title="Height & Weight"
          subtitle="This will be used to calibrate your custom plan."
          currentStep={6}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
          canContinue={data.height !== "" && data.weight !== ""}
        >
          <HeightWeightStep
            height={data.height}
            weight={data.weight}
            isMetric={data.isMetric}
            onHeightChange={(height) => setData({ ...data, height })}
            onWeightChange={(weight) => setData({ ...data, weight })}
            onUnitToggle={(isMetric) => setData({ ...data, isMetric })}
          />
        </OnboardingStep>
      )}

      {step === 7 && (
        <OnboardingStep
          title="When were you born?"
          subtitle="This will be used to calibrate your custom plan."
          currentStep={7}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
          canContinue={data.birthMonth !== "" && data.birthYear !== ""}
        >
          <BirthdateStep
            month={data.birthMonth}
            year={data.birthYear}
            onMonthChange={(month) => setData({ ...data, birthMonth: month })}
            onYearChange={(year) => setData({ ...data, birthYear: year })}
          />
        </OnboardingStep>
      )}

      {step === 8 && (
        <OnboardingStep
          title="What is your goal?"
          subtitle="This helps us generate a plan for your calorie intake."
          currentStep={8}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
          canContinue={data.goal !== null}
        >
          <GoalStep
            selected={data.goal}
            onSelect={(goal) => setData({ ...data, goal })}
          />
        </OnboardingStep>
      )}

      {step === 9 && (
        <OnboardingStep
          title="What is your desired weight?"
          currentStep={9}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
        >
          <TargetWeightStep
            currentWeight={parseFloat(data.weight) || 75}
            targetWeight={data.targetWeight}
            goal={data.goal || "maintain"}
            isMetric={data.isMetric}
            onTargetChange={(value) => setData({ ...data, targetWeight: value[0] })}
          />
        </OnboardingStep>
      )}

      {step === 10 && (
        <OnboardingStep
          title=""
          currentStep={10}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
        >
          <GoalFeedbackStep
            targetDifference={Math.abs(data.targetWeight - (parseFloat(data.weight) || 75))}
            goal={data.goal || "maintain"}
            unit={data.isMetric ? "kg" : "lbs"}
          />
        </OnboardingStep>
      )}

      {step === 11 && (
        <OnboardingStep
          title="How fast do you want to reach your goal?"
          currentStep={11}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
          canContinue={data.speed !== null}
        >
          <SpeedStep
            selected={data.speed}
            onSelect={(speed) => setData({ ...data, speed })}
          />
        </OnboardingStep>
      )}

      {step === 12 && (
        <OnboardingStep
          title="Gain twice as much weight with Cal AI vs on your own"
          currentStep={12}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
        >
          <ComparisonStep />
        </OnboardingStep>
      )}

      {step === 13 && (
        <OnboardingStep
          title="What's stopping you from reaching your goals?"
          currentStep={13}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
          canContinue={data.obstacles.length > 0}
        >
          <ObstaclesStep
            selected={data.obstacles}
            onToggle={(obstacle) =>
              setData({ ...data, obstacles: toggleArrayItem(data.obstacles, obstacle) })
            }
          />
        </OnboardingStep>
      )}

      {step === 14 && (
        <OnboardingStep
          title="Do you follow a specific diet?"
          currentStep={14}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
          canContinue={data.diet !== null}
        >
          <DietStep
            selected={data.diet}
            onSelect={(diet) => setData({ ...data, diet })}
          />
        </OnboardingStep>
      )}

      {step === 15 && (
        <OnboardingStep
          title="What would you like to accomplish?"
          currentStep={15}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
          canContinue={data.accomplishments.length > 0}
        >
          <AccomplishStep
            selected={data.accomplishments}
            onToggle={(goal) =>
              setData({ ...data, accomplishments: toggleArrayItem(data.accomplishments, goal) })
            }
          />
        </OnboardingStep>
      )}

      {step === 16 && (
        <OnboardingStep
          title="You have great potential to crush your goal"
          currentStep={16}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
        >
          <PotentialStep />
        </OnboardingStep>
      )}

      {step === 17 && (
        <OnboardingStep
          title=""
          currentStep={17}
          totalSteps={totalSteps}
          onBack={handleBack}
          onContinue={handleContinue}
        >
          <ResultsStep />
        </OnboardingStep>
      )}

      {step === 18 && <FinalLoadingStep />}
    </>
  );
};

export default Onboarding;
