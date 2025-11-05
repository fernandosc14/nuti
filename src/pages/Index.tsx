import { useState } from "react";
import { TabBar } from "@/components/TabBar";
import { Dashboard } from "@/components/Dashboard";
import { AddMeal } from "@/components/AddMeal";
import { AIChat } from "@/components/AIChat";
import { Profile } from "@/components/Profile";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");

  const handleAddMeal = () => {
    setActiveTab("meals");
  };

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return <Dashboard onAddMeal={handleAddMeal} />;
      case "meals":
        return <AddMeal onBack={() => setActiveTab("home")} />;
      case "chat":
        return <AIChat />;
      case "profile":
        return <Profile />;
      default:
        return <Dashboard onAddMeal={handleAddMeal} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {renderContent()}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
