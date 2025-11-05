import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface HeightWeightStepProps {
  height: string;
  weight: string;
  isMetric: boolean;
  onHeightChange: (value: string) => void;
  onWeightChange: (value: string) => void;
  onUnitToggle: (value: boolean) => void;
}

export const HeightWeightStep = ({
  height,
  weight,
  isMetric,
  onHeightChange,
  onWeightChange,
  onUnitToggle,
}: HeightWeightStepProps) => {
  return (
    <div className="pt-4 space-y-6">
      <div className="flex items-center justify-between bg-muted/30 rounded-2xl p-4">
        <span className="text-sm font-medium text-foreground">Imperial</span>
        <Switch checked={isMetric} onCheckedChange={onUnitToggle} />
        <span className="text-sm font-medium text-foreground">Metric</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-foreground mb-2 block">Height</Label>
          <Input
            type="number"
            value={height}
            onChange={(e) => onHeightChange(e.target.value)}
            placeholder={isMetric ? "180" : "5.9"}
            className="h-12 text-center text-lg font-semibold rounded-xl"
          />
          <p className="text-xs text-muted-foreground text-center mt-1">
            {isMetric ? "cm" : "ft"}
          </p>
        </div>

        <div>
          <Label className="text-foreground mb-2 block">Weight</Label>
          <Input
            type="number"
            value={weight}
            onChange={(e) => onWeightChange(e.target.value)}
            placeholder={isMetric ? "75" : "165"}
            className="h-12 text-center text-lg font-semibold rounded-xl"
          />
          <p className="text-xs text-muted-foreground text-center mt-1">
            {isMetric ? "kg" : "lbs"}
          </p>
        </div>
      </div>
    </div>
  );
};
