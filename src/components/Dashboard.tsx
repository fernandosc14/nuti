import { CalorieProgress } from "./CalorieProgress";
import { MealList } from "./MealList";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface DashboardProps {
  onAddMeal: () => void;
}

export const Dashboard = ({ onAddMeal }: DashboardProps) => {
  return (
    <div className="p-6 pb-24 space-y-6 max-w-md mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Olá! 👋</h1>
        <p className="text-muted-foreground">Como está a correr o seu dia?</p>
      </div>
      
      <CalorieProgress consumed={1050} goal={2000} />
      
      <MealList />
      
      <Button 
        onClick={onAddMeal}
        className="w-full h-14 rounded-2xl shadow-soft-md hover:shadow-soft-lg transition-smooth"
        size="lg"
      >
        <Plus className="h-5 w-5 mr-2" />
        Adicionar Refeição
      </Button>
    </div>
  );
};
