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
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

**Importante - Configuração do Google Sign-In:**
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto ou selecione um existente
3. Ative a API "Google+ API" ou "Google Identity"
4. Vá em "Credenciais" > "Criar credenciais" > "ID do cliente OAuth 2.0"
5. Selecione "Aplicativo Web" como tipo
6. Adicione os URIs de redirecionamento autorizados:
   - Para Expo Go: `https://auth.expo.io/@your-expo-username/nuti`
   - Para desenvolvimento local: `https://auth.expo.io/@anonymous/nuti`
   - (O Expo gera automaticamente o URI correto no runtime)
7. Copie o "ID do cliente" e cole em `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` no `.env`
8. No Firebase Console, vá em Authentication > Sign-in method > Google
9. Ative o método de login do Google e use o mesmo Client ID do passo 7
10. Adicione o mesmo Client ID em "Web SDK configuration"

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

## 🏗️ Testar no Android

### Opção 1: Expo Go (Mais Rápido - Recomendado para começar)

1. **Instala Expo Go no teu telefone Android** (Google Play Store)

2. **Inicia o servidor:**
```bash
cd mobile
npm start
```

3. **Conecta o telefone:**
   - Certifica-te que telefone e computador estão na mesma rede Wi-Fi
   - Escaneia o QR code com Expo Go OU
   - Digita o URL manualmente no Expo Go

4. **Google Sign-In funciona automaticamente** via web proxy (não precisa de SHA-1)

### Opção 2: Dev Client (Mais Completo - Para produção)

**Para Google Sign-In nativo funcionar, precisas do SHA-1:**

**Windows:**
```powershell
cd mobile/android
.\get-sha1.ps1
```

**Linux/Mac:**
```bash
cd mobile/android
chmod +x get-sha1.sh
./get-sha1.sh
```

**Manual:**
```bash
cd mobile/android/app
keytool -list -v -keystore debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Depois configura no Google Cloud Console:**
1. Cria OAuth 2.0 Client ID (tipo Android)
2. Package name: `com.nuti.app`
3. SHA-1: (colar o SHA-1 obtido)
4. Adiciona `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` no `.env`

**Build do Dev Client:**

**Local (requer Android Studio):**
```bash
cd mobile
npx expo run:android
```

**Com EAS (mais fácil):**
```bash
npm install -g eas-cli
eas login
cd mobile
eas build --platform android --profile development
```

📖 **Guia completo:** Ver `TESTE_ANDROID.md` para instruções detalhadas

## 📝 Notas Importantes

1. **Firebase**: Configurar projeto Firebase e adicionar credenciais no `.env`
2. **Groq API**: Obter API key em https://console.groq.com
3. **Google Sign-In**: 
   - Para Expo Go: Usa o proxy do Expo (`auth.expo.io`) - funciona automaticamente com `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - Para dev-client/standalone: Pode usar login nativo (requer configuração adicional no Google Console)
   - O redirect URI é gerado automaticamente pelo Expo no runtime
   - Certifique-se de que o mesmo Client ID está configurado no Firebase Console
4. **Badges**: As badges são inicializadas automaticamente na primeira execução
5. **Variáveis de Ambiente**: Nunca commitar o ficheiro `.env` - usar `.env.example` como referência

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

