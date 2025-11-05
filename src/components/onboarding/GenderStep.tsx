import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GenderStepProps {
  selected: string | null;
  onSelect: (gender: string) => void;
}

export const GenderStep = ({ selected, onSelect }: GenderStepProps) => {
  const options = ["Male", "Female", "Other"];

  return (
    <div className="space-y-3 pt-4">
      {options.map((option) => (
        <Card
          key={option}
          onClick={() => onSelect(option)}
          className={cn(
            "p-5 text-center cursor-pointer transition-smooth shadow-soft-sm border-2",
            selected === option
              ? "bg-foreground text-background border-foreground"
              : "bg-card text-foreground border-border hover:border-foreground/30"
          )}
        >
          <span className="text-base font-semibold">{option}</span>
        </Card>
      ))}
    </div>
  );
};
