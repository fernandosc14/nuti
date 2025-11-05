import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Clock, Utensils, Users, Calendar, Lightbulb } from "lucide-react";

interface ObstaclesStepProps {
  selected: string[];
  onToggle: (obstacle: string) => void;
}

export const ObstaclesStep = ({ selected, onToggle }: ObstaclesStepProps) => {
  const obstacles = [
    { value: "consistency", label: "Lack of consistency", icon: Clock },
    { value: "habits", label: "Unhealthy eating habits", icon: Utensils },
    { value: "support", label: "Lack of support", icon: Users },
    { value: "schedule", label: "Busy schedule", icon: Calendar },
    { value: "inspiration", label: "Lack of meal inspiration", icon: Lightbulb },
  ];

  return (
    <div className="space-y-3 pt-4">
      {obstacles.map((obstacle) => {
        const Icon = obstacle.icon;
        const isSelected = selected.includes(obstacle.value);
        
        return (
          <Card
            key={obstacle.value}
            onClick={() => onToggle(obstacle.value)}
            className={cn(
              "p-4 cursor-pointer transition-smooth shadow-soft-sm border-2",
              isSelected
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border hover:border-foreground/30"
            )}
          >
            <div className="flex items-center gap-3">
              <Icon
                className={cn(
                  "h-5 w-5",
                  isSelected ? "text-background" : "text-foreground"
                )}
              />
              <span className="text-sm font-medium">{obstacle.label}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
