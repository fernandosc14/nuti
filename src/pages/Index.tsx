import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TabBar } from "@/components/TabBar";
import { Dashboard } from "@/components/Dashboard";
import { AddMeal } from "@/components/AddMeal";
import { AIChat } from "@/components/AIChat";
import { Profile } from "@/components/Profile";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

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
