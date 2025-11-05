import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language = 'pt' } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user profile
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user) {
      throw new Error('User not found');
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Get recent meals for context
    const { data: recentMeals } = await supabaseClient
      .from('meals')
      .select('name, calories, protein, carbs, fat, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Calculate today's totals
    const today = new Date().toISOString().split('T')[0];
    const { data: todayMeals } = await supabaseClient
      .from('meals')
      .select('calories, protein, carbs, fat')
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    const todayTotals = todayMeals?.reduce((acc, meal) => ({
      calories: acc.calories + (meal.calories || 0),
      protein: acc.protein + (meal.protein || 0),
      carbs: acc.carbs + (meal.carbs || 0),
      fat: acc.fat + (meal.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const profileContext = profile ? `
Informações do Utilizador:
- Nome: ${profile.name}
- Peso: ${profile.weight ? `${profile.weight}kg` : 'não definido'}
- Altura: ${profile.height ? `${profile.height}cm` : 'não definida'}
- Objetivo: ${profile.goal === 'lose' ? 'perder peso' : profile.goal === 'gain' ? 'ganhar peso' : 'manter peso'}
- Restrições alimentares: ${profile.dietary_restrictions?.join(', ') || 'nenhuma'}
- Streak atual: ${profile.streak} dias consecutivos 🔥
- Plano: ${profile.plan === 'premium' ? 'Premium ⭐' : 'Free'}

Consumo de Hoje:
- ${todayTotals?.calories || 0} kcal
- Proteína: ${todayTotals?.protein?.toFixed(1) || 0}g
- Carboidratos: ${todayTotals?.carbs?.toFixed(1) || 0}g
- Gordura: ${todayTotals?.fat?.toFixed(1) || 0}g

${recentMeals?.length ? `Últimas refeições:\n${recentMeals.map(m => `- ${m.name} (${m.calories} kcal, P:${m.protein}g C:${m.carbs}g G:${m.fat}g)`).join('\n')}` : 'Nenhuma refeição registada ainda.'}
` : '';

    const languageInstructions = {
      pt: 'Responde sempre em Português de Portugal, de forma amigável e motivadora.',
      en: 'Always respond in English, in a friendly and motivating way.',
      es: 'Responde siempre en Español, de forma amigable y motivadora.',
      fr: 'Réponds toujours en Français, de manière amicale et motivante.'
    };

    const systemPrompt = `És o NutriBot, um assistente de nutrição inteligente e amigável. ${languageInstructions[language as keyof typeof languageInstructions] || languageInstructions.pt}

${profileContext}

Tens acesso a todas as informações nutricionais do utilizador acima. Usa-as para dar conselhos personalizados e precisos sobre:
- Progresso em relação ao objetivo (perder/ganhar/manter peso)
- Balanço de macronutrientes (proteína, carboidratos, gordura)
- Sugestões de refeições baseadas no histórico
- Motivação baseada no streak atual
- Dicas adaptadas às restrições alimentares

Mantém as respostas:
- Curtas (2-4 frases)
- Positivas e encorajadoras
- Com 1-2 emojis relevantes
- Práticas e acionáveis
- Baseadas nos dados reais do utilizador

Celebra conquistas como streaks altos e progresso consistente!`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de uso excedido. Tenta novamente mais tarde." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Por favor atualiza o teu plano." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "Erro ao comunicar com a IA" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
