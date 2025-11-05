import { useState } from "react";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: string;
}

export const AIChat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Olá! Sou o NutriMate 🌱 Como posso ajudar hoje?",
      sender: "ai",
      timestamp: "10:00",
    },
  ]);

  const handleSend = () => {
    if (!message.trim()) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      content: message,
      sender: "user",
      timestamp: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
    };
    
    setMessages([...messages, newMessage]);
    setMessage("");
    
    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: "Boa escolha! 👏 As suas refeições estão equilibradas. Faltam-lhe proteínas hoje. Que tal um iogurte grego?",
        sender: "ai",
        timestamp: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto">
      <div className="p-6 border-b border-border bg-background">
        <h1 className="text-2xl font-bold text-foreground">Chat com IA</h1>
        <p className="text-sm text-muted-foreground">Peça sugestões e feedback</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/30">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.sender === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-3xl px-4 py-3 shadow-soft-sm",
                msg.sender === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-card-foreground border border-border"
              )}
            >
              <p className="text-sm leading-relaxed">{msg.content}</p>
              <p
                className={cn(
                  "text-xs mt-1",
                  msg.sender === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                )}
              >
                {msg.timestamp}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border bg-background pb-20">
        <div className="flex gap-2">
          <Input
            placeholder="Escreva a sua mensagem..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 h-12 rounded-2xl border-border"
          />
          <Button
            onClick={handleSend}
            size="icon"
            className="h-12 w-12 rounded-2xl shadow-soft-md"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
