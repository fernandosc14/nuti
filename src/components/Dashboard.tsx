import { useEffect, useState } from "react";
import { CalorieProgress } from "./CalorieProgress";
import { MealList } from "./MealList";
import { Button } from "@/components/ui/button";
import { Plus, Flame, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getUserBadges, type Badge } from "@/services/gamification";

interface DashboardProps {
  onAddMeal: () => void;
}

export const Dashboard = ({ onAddMeal }: DashboardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [consumed, setConsumed] = useState(0);
  const [goal, setGoal] = useState(2000);
  const [streak, setStreak] = useState(0);
  const [userName, setUserName] = useState("Utilizador");
  const [recentBadges, setRecentBadges] = useState<Badge[]>([]);
  const [plan, setPlan] = useState<'free' | 'premium'>('free');

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserName(profile.name);
        setStreak(profile.streak || 0);
        setPlan((profile.plan as 'free' | 'premium') || 'free');

        // Calculate calorie goal based on user data
        if (profile.weight && profile.height && profile.goal) {
          const bmr = 10 * profile.weight + 6.25 * profile.height - 5 * 30 + 5;
          const goalMultiplier = profile.goal === 'lose' ? 0.8 : profile.goal === 'gain' ? 1.2 : 1;
          setGoal(Math.round(bmr * 1.5 * goalMultiplier));
        }
      }

      // Fetch today's meals
      const today = new Date().toISOString().split('T')[0];
      const { data: meals } = await supabase
        .from('meals')
        .select('calories')
        .eq('user_id', user.id)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);

      if (meals) {
        const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
        setConsumed(totalCalories);
      }

      // Fetch recent badges
      const badges = await getUserBadges(user.id);
      setRecentBadges(badges.slice(0, 3));
    };

    fetchData();
  }, [user]);

  return (
    <div className="p-6 pb-24 space-y-6 max-w-md mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Olá, {userName}! 👋</h1>
        <p className="text-muted-foreground">Como está a correr o seu dia?</p>
      </div>

      {streak > 0 && (
        <div className="bg-card rounded-2xl p-4 border border-border shadow-soft-sm flex items-center gap-3">
          <Flame className="h-8 w-8 text-orange-500" />
          <div>
            <p className="font-semibold text-foreground">{streak} dias consecutivos!</p>
            <p className="text-sm text-muted-foreground">Continua assim! 🔥</p>
          </div>
        </div>
      )}

      {recentBadges.length > 0 && (
        <div className="bg-card rounded-2xl p-4 border border-border shadow-soft-sm">
          <div className="flex items-center gap-2 mb-3">
            <Award className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Badges Recentes</h3>
          </div>
          <div className="flex gap-3">
            {recentBadges.map((badge) => (
              <div
                key={badge.id}
                className="flex flex-col items-center gap-1 p-2 bg-muted rounded-xl"
              >
                <span className="text-2xl">{badge.icon}</span>
                <span className="text-xs text-muted-foreground text-center">
                  {badge.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <CalorieProgress consumed={consumed} goal={goal} />
      
      <MealList />
      
      <Button 
        onClick={onAddMeal}
        className="w-full h-14 rounded-2xl shadow-soft-md hover:shadow-soft-lg transition-smooth"
        size="lg"
      >
        <Plus className="h-5 w-5 mr-2" />
        Adicionar Refeição
      </Button>

      {plan === 'free' && (
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-4 border border-primary/20">
          <p className="text-sm text-foreground mb-2">
            ✨ Atualiza para Premium para ter acesso a chat IA ilimitado e relatórios personalizados!
          </p>
        </div>
      )}
    </div>
  );
};
