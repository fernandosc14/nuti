import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WorkoutStepProps {
  selected: string | null;
  onSelect: (frequency: string) => void;
}

export const WorkoutStep = ({ selected, onSelect }: WorkoutStepProps) => {
  const options = [
    { value: "0-2", label: "0-2", description: "Workouts now and then" },
    { value: "3-5", label: "3-5", description: "A few workouts per week" },
    { value: "6+", label: "6+", description: "Dedicated athlete" },
  ];

  return (
    <div className="space-y-3 pt-4">
      {options.map((option) => (
        <Card
          key={option.value}
          onClick={() => onSelect(option.value)}
          className={cn(
            "p-5 cursor-pointer transition-smooth shadow-soft-sm border-2",
            selected === option.value
              ? "bg-foreground text-background border-foreground"
              : "bg-card text-foreground border-border hover:border-foreground/30"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                selected === option.value
                  ? "border-background"
                  : "border-muted-foreground"
              )}
            >
              {selected === option.value && (
                <div className="w-3 h-3 rounded-full bg-background" />
              )}
            </div>
            <div>
              <div className="font-semibold text-base">{option.label}</div>
              <div
                className={cn(
                  "text-sm",
                  selected === option.value
                    ? "text-background/80"
                    : "text-muted-foreground"
                )}
              >
                {option.description}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
