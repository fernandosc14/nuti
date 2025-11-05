import { useState } from "react";
import { ArrowLeft, Search, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { searchFood, type FoodItem } from "@/services/foodApi";
import { checkAndAwardBadges } from "@/services/gamification";
import { Loader2 } from "lucide-react";

interface AddMealProps {
  onBack: () => void;
}

export const AddMeal = ({ onBack }: AddMealProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [foodResults, setFoodResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<string>("breakfast");

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    const results = await searchFood(searchQuery);
    setFoodResults(results);
    setLoading(false);
  };

  const handleAddMeal = async (food: FoodItem) => {
    if (!user) return;

    try {
      // Update streak
      await supabase.rpc('update_streak', { p_user_id: user.id });

      // Insert meal
      const { error } = await supabase.from('meals').insert({
        user_id: user.id,
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        image_url: food.image,
        meal_type: selectedMealType,
      });

      if (error) throw error;

      // Check for new badges
      const newBadges = await checkAndAwardBadges(user.id);
      
      if (newBadges > 0) {
        toast({
          title: '🎉 Nova Badge!',
          description: `Ganhaste ${newBadges} nova${newBadges > 1 ? 's' : ''} badge${newBadges > 1 ? 's' : ''}!`,
        });
      }

      toast({
        title: 'Refeição adicionada!',
        description: `${food.name} foi adicionado ao teu diário.`,
      });

      onBack();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-6 pb-24 space-y-6 max-w-md mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Adicionar Refeição</h1>
          <p className="text-sm text-muted-foreground">Pesquisa ou digitaliza um alimento</p>
        </div>
      </div>

      <div className="space-y-4">
        <Select value={selectedMealType} onValueChange={setSelectedMealType}>
          <SelectTrigger className="h-12 rounded-2xl">
            <SelectValue placeholder="Tipo de refeição" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="breakfast">Pequeno-almoço</SelectItem>
            <SelectItem value="lunch">Almoço</SelectItem>
            <SelectItem value="dinner">Jantar</SelectItem>
            <SelectItem value="snack">Lanche</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Pesquisar alimento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10 h-12 rounded-2xl border-border"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={loading}
            className="h-12 rounded-2xl"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Pesquisar"}
          </Button>
        </div>

        <Button
          variant="outline"
          className="w-full h-12 rounded-2xl border-border"
          onClick={() => toast({ title: "Em breve!", description: "Scanner de código de barras em desenvolvimento." })}
        >
          <Camera className="h-5 w-5 mr-2" />
          Ler Código de Barras
        </Button>
      </div>

      <div className="space-y-3">
        {foodResults.map((food) => (
          <Card key={food.id} className="p-4 border-border shadow-soft-sm rounded-2xl">
            <div className="flex items-start gap-4">
              {food.image && (
                <img
                  src={food.image}
                  alt={food.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-2">{food.name}</h3>
                <div className="flex gap-4 text-sm text-muted-foreground mb-3">
                  <span>{food.calories} kcal</span>
                  <span>P: {food.protein}g</span>
                  <span>C: {food.carbs}g</span>
                  <span>G: {food.fat}g</span>
                </div>
                <Button
                  onClick={() => handleAddMeal(food)}
                  size="sm"
                  className="rounded-xl"
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
