import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Apple } from "lucide-react";

interface DietStepProps {
  selected: string | null;
  onSelect: (diet: string) => void;
}

export const DietStep = ({ selected, onSelect }: DietStepProps) => {
  const diets = [
    { value: "classic", label: "Classic" },
    { value: "pescatarian", label: "Pescatarian" },
    { value: "vegetarian", label: "Vegetarian" },
    { value: "vegan", label: "Vegan" },
  ];

  return (
    <div className="space-y-3 pt-4">
      {diets.map((diet) => {
        const isSelected = selected === diet.value;
        
        return (
          <Card
            key={diet.value}
            onClick={() => onSelect(diet.value)}
            className={cn(
              "p-4 cursor-pointer transition-smooth shadow-soft-sm border-2",
              isSelected
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border hover:border-foreground/30"
            )}
          >
            <div className="flex items-center gap-3">
              <Apple
                className={cn(
                  "h-5 w-5",
                  isSelected ? "text-background" : "text-primary"
                )}
              />
              <span className="text-base font-medium">{diet.label}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
