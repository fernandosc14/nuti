import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface TargetWeightStepProps {
  currentWeight: number;
  targetWeight: number;
  goal: string;
  isMetric: boolean;
  onTargetChange: (value: number[]) => void;
}

export const TargetWeightStep = ({
  currentWeight,
  targetWeight,
  goal,
  isMetric,
  onTargetChange,
}: TargetWeightStepProps) => {
  const unit = isMetric ? "kg" : "lbs";
  const difference = Math.abs(targetWeight - currentWeight);
  const direction = goal === "gain" ? "Gaining" : goal === "lose" ? "Losing" : "Maintaining";

  return (
    <div className="pt-4 space-y-8">
      <div className="text-center">
        <div className="text-sm text-muted-foreground mb-2">
          {goal === "gain" ? "Gain weight" : goal === "lose" ? "Lose weight" : "Current weight"}
        </div>
        <div className="text-5xl font-bold text-foreground mb-8">
          {targetWeight.toFixed(1)} {unit}
        </div>

        <div className="h-32 relative flex items-end justify-center gap-1">
          {Array.from({ length: 30 }, (_, i) => {
            const height = Math.random() * 60 + 20;
            const isCenter = i === 15;
            return (
              <div
                key={i}
                className={cn(
                  "w-1 rounded-full transition-smooth",
                  isCenter ? "bg-primary" : "bg-muted"
                )}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
      </div>

      <Slider
        value={[targetWeight]}
        onValueChange={onTargetChange}
        min={currentWeight - 50}
        max={currentWeight + 50}
        step={0.1}
        className="w-full"
      />
    </div>
  );
};
