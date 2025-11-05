import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Instagram, Facebook, Youtube } from "lucide-react";

interface SourceStepProps {
  selected: string | null;
  onSelect: (source: string) => void;
}

export const SourceStep = ({ selected, onSelect }: SourceStepProps) => {
  const options = [
    { value: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-500" },
    { value: "facebook", label: "Facebook", icon: Facebook, color: "text-blue-600" },
    { value: "tiktok", label: "TikTok", icon: null, color: "text-foreground" },
    { value: "youtube", label: "Youtube", icon: Youtube, color: "text-red-600" },
    { value: "google", label: "Google", icon: null, color: "text-foreground" },
    { value: "tv", label: "TV", icon: null, color: "text-foreground" },
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
              "p-4 cursor-pointer transition-smooth shadow-soft-sm border-2",
              selected === option.value
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border hover:border-foreground/30"
            )}
          >
            <div className="flex items-center gap-3">
              {Icon && (
                <Icon
                  className={cn(
                    "h-5 w-5",
                    selected === option.value ? "text-background" : option.color
                  )}
                />
              )}
              {!Icon && (
                <div
                  className={cn(
                    "w-5 h-5 rounded flex items-center justify-center text-xs font-bold",
                    selected === option.value
                      ? "bg-background text-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {option.label[0]}
                </div>
              )}
              <span className="text-base font-medium">{option.label}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
