interface GoalFeedbackStepProps {
  targetDifference: number;
  goal: string;
  unit: string;
}

export const GoalFeedbackStep = ({
  targetDifference,
  goal,
  unit,
}: GoalFeedbackStepProps) => {
  const action = goal === "gain" ? "Gaining" : "Losing";
  
  return (
    <div className="pt-8 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-6xl mb-6">🎯</div>
        <h2 className="text-2xl font-bold text-foreground leading-tight">
          {action} <span className="text-primary">{targetDifference.toFixed(0)} {unit}</span> is a<br />
          realistic target. It's<br />
          not hard at all!
        </h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          90% of users say that the change is doable after using Cal AI & it just worked!
        </p>
      </div>
    </div>
  );
};
