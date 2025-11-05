export const ComparisonStep = () => {
  return (
    <div className="pt-8 space-y-8">
      <div className="bg-muted/30 rounded-3xl p-8 text-center">
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Without<br />Cal AI</div>
            <div className="h-32 bg-muted rounded-2xl flex items-end justify-center p-2">
              <div className="w-full h-1/4 bg-destructive/40 rounded-t" />
            </div>
            <div className="text-xl font-bold text-muted-foreground">20%</div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">With<br />Cal AI</div>
            <div className="h-32 bg-muted rounded-2xl flex items-end justify-center p-2">
              <div className="w-full h-full bg-primary rounded-t" />
            </div>
            <div className="text-xl font-bold text-primary">9X</div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Cal AI makes it easy and holds<br />you accountable
        </p>
      </div>
    </div>
  );
};
