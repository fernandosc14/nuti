export const PotentialStep = () => {
  return (
    <div className="pt-8 space-y-6">
      <div className="text-center space-y-4">
        <div className="text-6xl mb-4">🎯</div>
        <h2 className="text-2xl font-bold text-foreground leading-tight">
          You have great<br />potential to crush<br />your goal
        </h2>
      </div>

      <div className="bg-muted/30 rounded-3xl p-6">
        <p className="text-sm font-semibold text-foreground mb-4">Your weight transition</p>
        
        <div className="relative h-40">
          <svg viewBox="0 0 300 120" className="w-full h-full">
            {/* Grid */}
            <line x1="0" y1="30" x2="300" y2="30" stroke="currentColor" strokeWidth="0.5" className="text-border" strokeDasharray="4" />
            <line x1="0" y1="60" x2="300" y2="60" stroke="currentColor" strokeWidth="0.5" className="text-border" strokeDasharray="4" />
            <line x1="0" y1="90" x2="300" y2="90" stroke="currentColor" strokeWidth="0.5" className="text-border" strokeDasharray="4" />
            
            {/* Progress line */}
            <path
              d="M 0 90 L 75 85 L 150 70 L 225 50 L 300 30"
              fill="none"
              stroke="hsl(145, 60%, 50%)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            
            {/* Points */}
            <circle cx="0" cy="90" r="4" fill="hsl(145, 60%, 50%)" />
            <circle cx="75" cy="85" r="4" fill="hsl(145, 60%, 50%)" />
            <circle cx="150" cy="70" r="4" fill="hsl(145, 60%, 50%)" />
            <circle cx="225" cy="50" r="4" fill="hsl(145, 60%, 50%)" />
            <circle cx="300" cy="30" r="6" fill="hsl(38, 92%, 50%)" />
            
            {/* Labels */}
            <text x="10" y="110" fontSize="10" fill="currentColor" className="text-muted-foreground">3 Days</text>
            <text x="130" y="110" fontSize="10" fill="currentColor" className="text-muted-foreground">7 Days</text>
            <text x="250" y="110" fontSize="10" fill="currentColor" className="text-muted-foreground">30 Days</text>
          </svg>
        </div>

        <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
          Based on Cal AI's historical data, weight gains is usually delivered at first, but after 7 days, you can reach your goal ideally.
        </p>
      </div>
    </div>
  );
};
