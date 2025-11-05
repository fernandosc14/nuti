import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SpeedStepProps {
  selected: string | null;
  onSelect: (speed: string) => void;
}

export const SpeedStep = ({ selected, onSelect }: SpeedStepProps) => {
  const options = [
    { value: "0.2", label: "0.2 lbs", icon: "🐌" },
    { value: "1.0", label: "1.0 lbs", icon: "🦊", recommended: true },
    { value: "3.0", label: "3.0 lbs", icon: "🐆" },
  ];

  return (
    <div className="pt-4 space-y-4">
      <div className="text-center mb-6">
        <p className="text-sm text-muted-foreground">Gain weight speed per week</p>
        <p className="text-3xl font-bold text-foreground mt-2">
          {selected ? `${selected} lbs` : "1.0 lbs"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {options.map((option) => (
          <Card
            key={option.value}
            onClick={() => onSelect(option.value)}
            className={cn(
              "p-4 cursor-pointer transition-smooth text-center border-2",
              selected === option.value
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border hover:border-foreground/30"
            )}
          >
            <div className="text-3xl mb-2">{option.icon}</div>
            <div className="text-sm font-semibold">{option.label}</div>
          </Card>
        ))}
      </div>

      {selected === "1.0" && (
        <p className="text-xs text-center text-primary font-medium">Recommended</p>
      )}
    </div>
  );
};
