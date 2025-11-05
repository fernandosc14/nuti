import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface OnboardingStepProps {
  title: string;
  subtitle?: string;
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  onContinue: () => void;
  children: React.ReactNode;
  canContinue?: boolean;
}

export const OnboardingStep = ({
  title,
  subtitle,
  currentStep,
  totalSteps,
  onBack,
  onContinue,
  children,
  canContinue = true,
}: OnboardingStepProps) => {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
      <div className="p-6">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-full mb-4"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        
        <h1 className="text-3xl font-bold text-foreground mb-2">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex-1 px-6 pb-6">
        {children}
      </div>

      <div className="p-6 space-y-4">
        <Button
          onClick={onContinue}
          disabled={!canContinue}
          className="w-full h-14 rounded-full text-base font-semibold shadow-soft-md"
        >
          Continue
        </Button>
        
        <Progress value={progress} className="h-1" />
      </div>
    </div>
  );
};
