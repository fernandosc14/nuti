import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface PreviousAppStepProps {
  selected: string | null;
  onSelect: (answer: string) => void;
}

export const PreviousAppStep = ({ selected, onSelect }: PreviousAppStepProps) => {
  const options = [
    { value: "no", label: "No", icon: ThumbsDown },
    { value: "yes", label: "Yes", icon: ThumbsUp },
  ];

  return (
    <div className="space-y-3 pt-4">
      {options.map((option) => {
        const Icon = option.icon;
        
        return (
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
              <Icon
                className={cn(
                  "h-6 w-6",
                  selected === option.value ? "text-background" : "text-foreground"
                )}
              />
              <span className="text-base font-semibold">{option.label}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
