export const ResultsStep = () => {
  return (
    <div className="pt-8 space-y-8">
      <div className="bg-muted/30 rounded-3xl p-6 space-y-4">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            O NutriMate cria<br />resultados duradouros
          </h3>
        </div>

        <div className="relative h-48 bg-card rounded-2xl p-4 border border-border">
          <svg viewBox="0 0 300 150" className="w-full h-full">
            {/* Grid lines */}
            <line x1="0" y1="30" x2="300" y2="30" stroke="currentColor" strokeWidth="0.5" className="text-border" />
            <line x1="0" y1="75" x2="300" y2="75" stroke="currentColor" strokeWidth="0.5" className="text-border" />
            <line x1="0" y1="120" x2="300" y2="120" stroke="currentColor" strokeWidth="0.5" className="text-border" />
            
            {/* Traditional diet line (red) */}
            <path
              d="M 0 120 Q 50 60, 75 50 T 150 90 T 225 110 T 300 120"
              fill="none"
              stroke="hsl(0, 72%, 51%)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            
            {/* NutriMate line (primary green) */}
            <path
              d="M 0 120 Q 75 90, 150 60 T 300 30"
              fill="none"
              stroke="hsl(145, 60%, 50%)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            
            {/* Labels */}
            <text x="10" y="115" fontSize="10" fill="hsl(0, 72%, 51%)" fontWeight="600">
              Traditional diet
            </text>
            <text x="180" y="25" fontSize="10" fill="hsl(145, 60%, 50%)" fontWeight="600">
              NutriMate
            </text>
            
            {/* Axis labels */}
            <text x="10" y="145" fontSize="9" fill="currentColor" className="text-muted-foreground">
              Month 1
            </text>
            <text x="260" y="145" fontSize="9" fill="currentColor" className="text-muted-foreground">
              Month 6
            </text>
            <text x="5" y="15" fontSize="9" fill="currentColor" className="text-muted-foreground">
              Your weight
            </text>
          </svg>
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-primary">80%</span> dos utilizadores do NutriMate<br />
            mantêm a perda de peso após 6 meses
          </p>
        </div>
      </div>
    </div>
  );
};
