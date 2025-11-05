import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Check } from "lucide-react";

export const FinalLoadingStep = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) {
          clearInterval(timer);
          return 92;
        }
        return prev + 4;
      });
    }, 100);

    return () => clearInterval(timer);
  }, []);

  const recommendations = [
    { label: "Calories", value: "2183", unit: "kcal" },
    { label: "Carbs", value: "280", unit: "g" },
    { label: "Protein", value: "163", unit: "g" },
    { label: "Fats", value: "58", unit: "g" },
    { label: "Health Score", value: "8.5", unit: "/10" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto p-6">
      <div className="flex-1 flex flex-col justify-center space-y-8">
        <div className="text-center space-y-4">
          <div className="text-7xl font-bold text-foreground">{progress}%</div>
          <h1 className="text-2xl font-bold text-foreground">
            We're setting<br />everything up for you
          </h1>
          <p className="text-sm text-muted-foreground">Finalizing results...</p>
        </div>

        <Progress value={progress} className="h-2" />

        <div className="bg-foreground text-background rounded-3xl p-6 space-y-3">
          <p className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Check className="h-4 w-4" />
            Daily recommendation for
          </p>
          <div className="space-y-2">
            {recommendations.map((rec) => (
              <div key={rec.label} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-background" />
                  <span className="text-sm">{rec.label}</span>
                </div>
                <span className="text-sm font-semibold">
                  {rec.value} {rec.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {progress >= 92 && (
        <div className="pt-4 pb-safe">
          <div className="text-center mb-4">
            <p className="text-sm font-bold text-foreground mb-1">
              Congratulations<br />your custom plan is ready!
            </p>
            <p className="text-xs text-muted-foreground">
              You should gain:<br />
              <span className="font-semibold">10 lbs by September 30</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
