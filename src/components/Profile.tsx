import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { User, Target, Activity } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Profile = () => {
  return (
    <div className="p-6 pb-24 space-y-6 max-w-md mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Perfil</h1>
        <p className="text-muted-foreground">Gerir os seus dados e preferências</p>
      </div>

      <Card className="p-6 shadow-soft-md border-border space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center">
            <User className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">João Silva</h2>
            <p className="text-sm text-muted-foreground">Utilizador desde Jan 2025</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="age" className="text-foreground">Idade</Label>
            <Input id="age" type="number" defaultValue="28" className="mt-1.5 h-11 rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="weight" className="text-foreground">Peso (kg)</Label>
              <Input id="weight" type="number" defaultValue="75" className="mt-1.5 h-11 rounded-xl" />
            </div>
            <div>
              <Label htmlFor="height" className="text-foreground">Altura (cm)</Label>
              <Input id="height" type="number" defaultValue="178" className="mt-1.5 h-11 rounded-xl" />
            </div>
          </div>

          <div>
            <Label htmlFor="goal" className="text-foreground">Objetivo</Label>
            <Select defaultValue="maintain">
              <SelectTrigger id="goal" className="mt-1.5 h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lose">Perder peso</SelectItem>
                <SelectItem value="maintain">Manter peso</SelectItem>
                <SelectItem value="gain">Ganhar peso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-5 shadow-soft-sm border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center">
            <Target className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <div className="font-semibold text-foreground">Meta Diária</div>
            <div className="text-sm text-muted-foreground">2000 kcal</div>
          </div>
        </div>
      </Card>

      <Card className="p-5 shadow-soft-sm border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center">
            <Activity className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <div className="font-semibold text-foreground">Nível de Atividade</div>
            <div className="text-sm text-muted-foreground">Moderado</div>
          </div>
        </div>
      </Card>

      <Button className="w-full h-12 rounded-2xl shadow-soft-md">
        Guardar Alterações
      </Button>
    </div>
  );
};
