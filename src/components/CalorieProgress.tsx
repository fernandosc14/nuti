import { Progress } from "@/components/ui/progress";

interface CalorieProgressProps {
  consumed: number;
  goal: number;
}

export const CalorieProgress = ({ consumed, goal }: CalorieProgressProps) => {
  const remaining = goal - consumed;
  const percentage = (consumed / goal) * 100;
  
  return (
    <div className="bg-gradient-primary rounded-3xl p-6 text-primary-foreground shadow-soft-lg">
      <h2 className="text-sm font-medium mb-4 opacity-90">Calorias Hoje</h2>
      
      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="text-4xl font-bold mb-1">{consumed}</div>
          <div className="text-sm opacity-80">consumidas</div>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-semibold mb-1">{remaining}</div>
          <div className="text-sm opacity-80">restantes</div>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-semibold mb-1">{goal}</div>
          <div className="text-sm opacity-80">meta</div>
        </div>
      </div>
      
      <Progress value={percentage} className="h-3 bg-primary-foreground/20" />
    </div>
  );
};
