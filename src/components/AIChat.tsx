import { useState, useEffect, useRef } from "react";
import { Send, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: string;
}

export const AIChat = () => {
  const { user, session } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState("pt");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50);

      if (data) {
        const formattedMessages = data.map(msg => ({
          id: msg.id,
          content: msg.content,
          role: msg.role as "user" | "assistant",
          timestamp: new Date(msg.created_at).toLocaleTimeString('pt-PT', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
        }));
        setMessages(formattedMessages);
      }
    };

    fetchMessages();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !user || loading) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      role: "user",
      timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setMessage("");
    setLoading(true);

    // Save user message
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      role: 'user',
      content: userMessage.content,
    });
    
    try {
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })).concat([
            { role: 'user', content: userMessage.content }
          ]),
          language,
        }),
      });

      if (!response.ok || !response.body) throw new Error('Failed to start stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let assistantId = (Date.now() + 1).toString();

      const updateAssistantMessage = (content: string) => {
        assistantContent = content;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.id === assistantId) {
            return prev.map((m, i) => 
              i === prev.length - 1 ? { ...m, content: assistantContent } : m
            );
          }
          return [...prev, {
            id: assistantId,
            role: "assistant",
            content: assistantContent,
            timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          }];
        });
      };

      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              updateAssistantMessage(assistantContent);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save assistant message
      if (assistantContent) {
        await supabase.from('chat_messages').insert({
          user_id: user.id,
          role: 'assistant',
          content: assistantContent,
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Desculpa, ocorreu um erro. Por favor, tenta novamente.",
        timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto">
      <div className="p-6 border-b border-border bg-background">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-foreground">Chat com IA</h1>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-[130px] h-9 rounded-xl border-border">
              <Globe className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pt">🇵🇹 PT</SelectItem>
              <SelectItem value="en">🇬🇧 EN</SelectItem>
              <SelectItem value="es">🇪🇸 ES</SelectItem>
              <SelectItem value="fr">🇫🇷 FR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">Peça sugestões personalizadas</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/30">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-lg mb-2">👋 Olá!</p>
            <p>Sou o NutriBot. Como posso ajudar hoje?</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-3xl px-4 py-3 shadow-soft-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-card-foreground border border-border"
              )}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              <p
                className={cn(
                  "text-xs mt-1",
                  msg.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                )}
              >
                {msg.timestamp}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card text-card-foreground border border-border rounded-3xl px-4 py-3">
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border bg-background pb-20">
        <div className="flex gap-2">
          <Input
            placeholder="Escreva a sua mensagem..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !loading && handleSend()}
            disabled={loading}
            className="flex-1 h-12 rounded-2xl border-border"
          />
          <Button
            onClick={handleSend}
            disabled={loading}
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
