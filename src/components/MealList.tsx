import { Coffee, Salad, Moon, Apple } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Meal {
  id: string;
  type: string;
  name: string;
  calories: number;
  time: string;
}

const mealIcons = {
  "Pequeno-almoço": Coffee,
  "Almoço": Salad,
  "Jantar": Moon,
  "Snack": Apple,
};

export const MealList = () => {
  const meals: Meal[] = [
    { id: "1", type: "Pequeno-almoço", name: "Aveia com fruta", calories: 320, time: "08:30" },
    { id: "2", type: "Snack", name: "Iogurte grego", calories: 150, time: "11:00" },
    { id: "3", type: "Almoço", name: "Frango grelhado com arroz", calories: 580, time: "13:30" },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground">Refeições de Hoje</h3>
      
      {meals.map((meal) => {
        const Icon = mealIcons[meal.type as keyof typeof mealIcons];
        
        return (
          <Card key={meal.id} className="p-4 shadow-soft-sm border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center">
                  <Icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <div className="font-medium text-foreground">{meal.name}</div>
                  <div className="text-sm text-muted-foreground">{meal.type} • {meal.time}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-primary">{meal.calories}</div>
                <div className="text-xs text-muted-foreground">kcal</div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
