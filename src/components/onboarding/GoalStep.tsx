import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GoalStepProps {
  selected: string | null;
  onSelect: (goal: string) => void;
}

export const GoalStep = ({ selected, onSelect }: GoalStepProps) => {
  const options = [
    { value: "lose", label: "Lose weight" },
    { value: "maintain", label: "Maintain" },
    { value: "gain", label: "Gain weight" },
  ];

  return (
    <div className="space-y-3 pt-4">
      {options.map((option) => (
        <Card
          key={option.value}
          onClick={() => onSelect(option.value)}
          className={cn(
            "p-5 text-center cursor-pointer transition-smooth shadow-soft-sm border-2",
            selected === option.value
              ? "bg-foreground text-background border-foreground"
              : "bg-card text-foreground border-border hover:border-foreground/30"
          )}
        >
          <span className="text-base font-semibold">{option.label}</span>
        </Card>
      ))}
    </div>
  );
};
