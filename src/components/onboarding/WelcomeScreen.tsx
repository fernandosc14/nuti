import { Button } from "@/components/ui/button";

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export const WelcomeScreen = ({ onGetStarted, onSignIn }: WelcomeScreenProps) => {
  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col items-center justify-between p-6 max-w-md mx-auto">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-32 h-32 mx-auto bg-gradient-primary rounded-full flex items-center justify-center mb-8 shadow-soft-lg">
            <span className="text-6xl">🥗</span>
          </div>
          
          <h1 className="text-4xl font-bold text-foreground">NutriMate</h1>
          <p className="text-xl text-muted-foreground">
            Controlo de calorias<br />simplificado
          </p>
        </div>
      </div>

      <div className="w-full space-y-3">
        <Button
          onClick={onGetStarted}
          className="w-full h-14 rounded-full text-base font-semibold shadow-soft-md"
        >
          Get Started
        </Button>
        
        <button
          onClick={onSignIn}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-smooth"
        >
          Purchased on the web? Sign In
        </button>
        
        <div className="h-1 w-24 bg-foreground/20 rounded-full mx-auto mt-4" />
      </div>
    </div>
  );
};
