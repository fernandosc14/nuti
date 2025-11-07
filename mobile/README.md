/**
 * README.md
 * 
 * Documentação do projeto Nuti Mobile
 */

# Nuti - App Mobile

App mobile nativa desenvolvida com Expo + React Native + NativeWind + Firebase + Groq API.

## 🚀 Stack Técnica

- **Framework**: React Native com Expo
- **Estilos**: NativeWind (Tailwind para React Native)
- **Base de dados**: Firebase Firestore
- **Autenticação**: Firebase Authentication (email + Google Sign-In)
- **Estado global**: Context API + AsyncStorage
- **APIs externas**:
  - Groq API para chat IA (modelo mixtral-8x7b)
  - Open Food Facts API para pesquisa de alimentos
- **Push Notifications**: expo-notifications
- **Câmara e código de barras**: expo-camera + expo-barcode-scanner
- **Animações**: react-native-reanimated e moti
- **Navegação**: @react-navigation/native-stack

## 📦 Instalação

1. Instalar dependências:
```bash
cd mobile
npm install
```

2. Configurar variáveis de ambiente:
Criar arquivo `.env` na raiz da pasta `mobile/`:
```
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
EXPO_PUBLIC_GROQ_API_KEY=your-groq-api-key
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-client-id
```

3. Iniciar o projeto:
```bash
npm start
```

## 🏗️ Estrutura do Projeto

```
mobile/
├── App.tsx                 # Componente principal
├── screens/               # Telas da aplicação
│   ├── LoginScreen.tsx
│   ├── RegisterScreen.tsx
│   ├── DashboardScreen.tsx
│   ├── AddMealScreen.tsx
│   ├── ChatScreen.tsx
│   ├── ProfileScreen.tsx
│   └── PremiumScreen.tsx
├── components/           # Componentes reutilizáveis
│   ├── MealCard.tsx
│   ├── BadgeItem.tsx
│   └── ChartCircle.tsx
├── services/            # Serviços e APIs
│   ├── firebase.ts
│   ├── api.ts
│   └── gamification.ts
├── context/            # Context API
│   └── UserContext.tsx
├── utils/              # Utilitários
│   ├── streakUtils.ts
│   └── formatters.ts
└── assets/             # Recursos (imagens, ícones)
```

## 🔥 Funcionalidades

### Autenticação
- Login e registo com email/password
- Login com Google Sign-In
- Gestão de sessão com AsyncStorage

### Dashboard
- Gráfico circular de calorias consumidas / meta diária
- Lista de refeições recentes
- Streak atual (dias consecutivos)
- Badges desbloqueadas
- Botão flutuante para adicionar refeição

### Refeições
- Pesquisa de alimentos (Open Food Facts API)
- Tirar foto de refeição (expo-camera)
- Ler código de barras (expo-barcode-scanner)
- Guardar refeição no Firestore

### Chat IA
- Chat interativo com IA via Groq API
- Histórico guardado no Firestore
- Limite de mensagens para utilizadores free (5/dia)
- Ilimitado para Premium

### Gamificação
- Streaks: +1 dia se ≥3 refeições registadas
- Badges automáticas:
  - Primeira Refeição
  - 3 Dias Seguidos
  - Semana Perfeita (7 dias)
  - Mês Perfeito (30 dias)
  - 10 Refeições
  - 50 Refeições

### Perfil
- Visualizar e editar dados pessoais
- Ver streak e badges
- Ativar Premium (simulação)

## 🏗️ Build para Android

1. Instalar EAS CLI:
```bash
npm install -g eas-cli
```

2. Fazer login:
```bash
eas login
```

3. Configurar projeto:
```bash
eas build:configure
```

4. Build para Android:
```bash
eas build --platform android
```

Ou usar Expo CLI:
```bash
npx expo build:android
```

## 📝 Notas Importantes

1. **Firebase**: Configurar projeto Firebase e adicionar credenciais no `.env`
2. **Groq API**: Obter API key em https://console.groq.com
3. **Google Sign-In**: Configurar OAuth no Firebase Console
4. **Badges**: As badges são inicializadas automaticamente na primeira execução

## 🎨 Tema

- Cor primária: Verde (#3BB273)
- Modo claro/escuro: Automático baseado no sistema
- UI moderna e fluida com animações suaves

## 📱 Requisitos

- Node.js 18+
- Expo CLI
- Android Studio (para build Android)
- Conta Expo (para EAS Build)

## 🔐 Segurança

- Nunca commitar arquivo `.env`
- Manter API keys seguras
- Usar variáveis de ambiente para todas as credenciais

## 📄 Licença

Projeto privado - Todos os direitos reservados

