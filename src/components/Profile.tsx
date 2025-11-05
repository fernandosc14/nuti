import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserBadges, type Badge } from "@/services/gamification";
import { LogOut, Award, Crown } from "lucide-react";

export const Profile = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [goal, setGoal] = useState<string>("maintain");
  const [plan, setPlan] = useState<'free' | 'premium'>('free');
  const [badges, setBadges] = useState<Badge[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setName(data.name);
        setWeight(data.weight?.toString() || "");
        setHeight(data.height?.toString() || "");
        setGoal(data.goal || "maintain");
        setPlan((data.plan as 'free' | 'premium') || 'free');
        setStreak(data.streak || 0);
      }

      const userBadges = await getUserBadges(user.id);
      setBadges(userBadges);
    };

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name,
          weight: weight ? parseFloat(weight) : null,
          height: height ? parseInt(height) : null,
          goal,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Perfil atualizado!',
        description: 'As tuas alterações foram guardadas.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="p-6 pb-24 space-y-6 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Perfil</h1>
          <p className="text-sm text-muted-foreground">Gere a tua informação</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          className="rounded-full"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      {plan === 'free' && (
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 shadow-soft-md rounded-2xl">
          <div className="flex items-start gap-4">
            <Crown className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-2">NutriMate Premium</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Chat IA ilimitado, relatórios semanais, planos de refeição personalizados e muito mais!
              </p>
              <Button size="sm" className="rounded-xl">
                Subscrever Premium
              </Button>
            </div>
          </div>
        </Card>
      )}

      {streak > 0 && (
        <Card className="p-4 border-border shadow-soft-sm rounded-2xl">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🔥</span>
            <div>
              <p className="font-semibold text-foreground text-lg">{streak} dias</p>
              <p className="text-sm text-muted-foreground">Streak atual</p>
            </div>
          </div>
        </Card>
      )}

      {badges.length > 0 && (
        <Card className="p-6 border-border shadow-soft-sm rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">As Minhas Badges</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className="flex flex-col items-center gap-2 p-3 bg-muted rounded-xl"
              >
                <span className="text-3xl">{badge.icon}</span>
                <span className="text-xs text-center text-muted-foreground">
                  {badge.name}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6 border-border shadow-soft-sm rounded-2xl space-y-4">
        <h3 className="font-semibold text-foreground">Informação Pessoal</h3>
        
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 rounded-2xl"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="weight">Peso (kg)</Label>
            <Input
              id="weight"
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="h-12 rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="height">Altura (cm)</Label>
            <Input
              id="height"
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="h-12 rounded-2xl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="goal">Objetivo</Label>
          <Select value={goal} onValueChange={setGoal}>
            <SelectTrigger className="h-12 rounded-2xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lose">Perder Peso</SelectItem>
              <SelectItem value="maintain">Manter Peso</SelectItem>
              <SelectItem value="gain">Ganhar Peso</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} className="w-full h-12 rounded-2xl shadow-soft-md">
          Guardar Alterações
        </Button>
      </Card>
    </div>
  );
};
