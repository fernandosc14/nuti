import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Heart, Zap, Target, Sparkles } from "lucide-react";

interface AccomplishStepProps {
  selected: string[];
  onToggle: (goal: string) => void;
}

export const AccomplishStep = ({ selected, onToggle }: AccomplishStepProps) => {
  const goals = [
    { value: "health", label: "Eat and live healthier", icon: Heart },
    { value: "energy", label: "Boost my energy and mood", icon: Zap },
    { value: "consistency", label: "Stay motivated and consistent", icon: Target },
    { value: "body", label: "Feel better about my body", icon: Sparkles },
  ];

  return (
    <div className="space-y-3 pt-4">
      {goals.map((goal) => {
        const Icon = goal.icon;
        const isSelected = selected.includes(goal.value);
        
        return (
          <Card
            key={goal.value}
            onClick={() => onToggle(goal.value)}
            className={cn(
              "p-5 cursor-pointer transition-smooth shadow-soft-sm border-2",
              isSelected
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border hover:border-foreground/30"
            )}
          >
            <div className="flex items-center gap-3">
              <Icon
                className={cn(
                  "h-6 w-6",
                  isSelected ? "text-background" : "text-primary"
                )}
              />
              <span className="text-base font-medium">{goal.label}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
