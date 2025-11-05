import { useEffect, useState } from "react";
import { Coffee, Utensils, Moon, Apple } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Meal {
  id: string;
  name: string;
  calories: number;
  meal_type: string;
  created_at: string;
}

const mealIcons = {
  breakfast: Coffee,
  lunch: Utensils,
  dinner: Moon,
  snack: Apple,
};

export const MealList = () => {
  const { user } = useAuth();
  const [meals, setMeals] = useState<Meal[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchMeals = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        setMeals(data);
      }
    };

    fetchMeals();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('meal-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meals',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchMeals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (meals.length === 0) {
    return (
      <Card className="p-6 text-center border-border shadow-soft-sm rounded-2xl">
        <p className="text-muted-foreground">
          Ainda não registaste refeições hoje.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Adiciona a tua primeira refeição! 🍽️
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Refeições de Hoje</h2>
      {meals.map((meal) => {
        const Icon = mealIcons[meal.meal_type as keyof typeof mealIcons] || Apple;
        
        return (
          <Card
            key={meal.id}
            className="p-4 flex items-center gap-4 border-border shadow-soft-sm rounded-2xl hover:shadow-soft-md transition-smooth"
          >
            <div className="bg-muted rounded-xl p-3">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">{meal.name}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(meal.created_at).toLocaleTimeString('pt-PT', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-primary">{meal.calories}</p>
              <p className="text-xs text-muted-foreground">kcal</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
