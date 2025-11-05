import { useState } from "react";
import { Search, Scan, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface AddMealProps {
  onBack: () => void;
}

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const AddMeal = ({ onBack }: AddMealProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  
  const foodResults: FoodItem[] = [
    { id: "1", name: "Peito de frango (100g)", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    { id: "2", name: "Arroz branco (100g)", calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
    { id: "3", name: "Brócolos (100g)", calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  ];

  return (
    <div className="p-6 pb-24 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBack}
          className="rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Adicionar Refeição</h1>
      </div>

      <div className="space-y-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar alimento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-2xl border-border"
          />
        </div>
        
        <Button 
          variant="outline" 
          className="w-full h-12 rounded-2xl border-border"
        >
          <Scan className="h-5 w-5 mr-2" />
          Ler Código de Barras
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Resultados</h3>
        
        {foodResults.map((food) => (
          <Card key={food.id} className="p-4 shadow-soft-sm border-border">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-semibold text-foreground mb-1">{food.name}</div>
                <div className="text-sm text-muted-foreground">
                  P: {food.protein}g • C: {food.carbs}g • G: {food.fat}g
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-primary">{food.calories}</div>
                <div className="text-xs text-muted-foreground">kcal</div>
              </div>
            </div>
            
            <Button 
              size="sm" 
              className="w-full rounded-xl"
            >
              Guardar Refeição
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};
