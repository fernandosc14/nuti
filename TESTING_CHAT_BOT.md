# Guia de Teste do Chat Bot

## 📋 Como Testar e Verificar Erros

### 1. **Verificar Logs no Console**

#### **Metro Bundler (Terminal onde corre `npm start` ou `expo start`)**
- Todos os `console.error`, `console.warn` e `console.log` aparecem aqui
- Procura por:
  - `Error loading messages:`
  - `Error loading user context:`
  - `Error sending chat message:`
  - `Error checking rate limit:`
  - `Error transcribing audio:`
  - `Error parsing meal suggestion:`
  - `Error parsing exercise suggestion:`

#### **React Native Debugger** (se estiveres a usar)
- Abre o DevTools (Chrome DevTools)
- Vai à aba "Console" para ver todos os logs

#### **Expo Go / App Standalone**
- Liga o dispositivo/emulador
- Os logs aparecem no terminal do Metro Bundler
- Para ver logs mais detalhados, podes usar `npx react-native log-android` (Android) ou `npx react-native log-ios` (iOS)

---

### 2. **Cenários de Teste Manual**

#### **A. Teste de Premium Check**
1. ✅ **Utilizador Free**: Tenta enviar mensagem → Deve mostrar toast "Premium Necessário"
2. ✅ **Utilizador Premium**: Deve conseguir enviar mensagens normalmente

#### **B. Teste de Rate Limiting**
1. ✅ Envia 5 mensagens rapidamente (dentro de 1 minuto)
2. ✅ Tenta enviar a 6ª mensagem → Deve mostrar toast "Limite de mensagens atingido"
3. ✅ Espera 1 minuto e tenta novamente → Deve funcionar

**Como resetar o rate limit para testes:**
```javascript
// No console do Metro ou DevTools, executa:
import AsyncStorage from '@react-native-async-storage/async-storage';
AsyncStorage.removeItem('chat_rate_limit_SEU_USER_ID');
```

#### **C. Teste de Envio de Mensagens**
1. ✅ **Mensagem normal**: Envia "Como posso perder peso?"
2. ✅ **Mensagem muito curta**: Envia "Oi" → Deve mostrar toast "Mensagem muito curta"
3. ✅ **Mensagem com sugestão de refeição**: Pede uma refeição → Verifica se aparece botão "Adicionar Refeição"
4. ✅ **Mensagem com sugestão de treino**: Pede um treino → Verifica se aparece botão "Adicionar Treino"

#### **D. Teste de Parsing de JSON**
1. ✅ Verifica se o JSON da refeição/treino é parseado corretamente
2. ✅ Verifica se o nome da refeição/treino aparece em **negrito** na mensagem
3. ✅ Verifica se a lista de alimentos aparece quando há sugestão de refeição

#### **E. Teste de Áudio**
1. ✅ Grava um áudio curto (< 3 segundos) → Deve mostrar "Gravação muito curta"
2. ✅ Grava um áudio válido → Deve transcrever e colocar no input
3. ✅ Grava apenas ruído → Deve mostrar "Áudio não reconhecido"

#### **F. Teste de Erros de API**
1. ✅ **Sem internet**: Desliga WiFi/dados → Tenta enviar mensagem → Deve mostrar erro
2. ✅ **API timeout**: (simular com throttling de rede) → Deve mostrar erro após timeout

#### **G. Teste de Firestore**
1. ✅ Verifica se as mensagens são guardadas no Firestore
2. ✅ Verifica se ao carregar o chat, as mensagens aparecem
3. ✅ Testa eliminar uma mensagem → Verifica se é marcada como `deleted: true`

---

### 3. **Verificar Erros Específicos**

#### **A. Erros na API Groq**
- **Onde verificar**: `mobile/services/api.ts` → função `sendChatMessage`
- **Log**: `Error sending chat message:`
- **Possíveis causas**:
  - API key inválida/expirada
  - Rate limit da Groq API
  - Timeout da requisição
  - Resposta mal formatada

#### **B. Erros de Parsing JSON**
- **Onde verificar**: `mobile/services/api.ts` → funções `parseMealSuggestion` e `parseExerciseSuggestion`
- **Logs**: `Error parsing meal suggestion:` ou `Error parsing exercise suggestion:`
- **Possíveis causas**:
  - JSON mal formatado pela IA
  - Campos obrigatórios em falta
  - Tipos de dados incorretos

#### **C. Erros de Rate Limiting**
- **Onde verificar**: `mobile/screens/ChatScreen.tsx` → função `checkRateLimit`
- **Log**: `Error checking rate limit:`
- **Possíveis causas**:
  - Erro ao ler/escrever no AsyncStorage
  - Dados corrompidos no AsyncStorage

#### **D. Erros de Firestore**
- **Onde verificar**: `mobile/screens/ChatScreen.tsx` → funções `loadMessages`, `handleSendMessage`
- **Logs**: `Error loading messages:`, `Error clearing chat:`, `Error deleting message:`
- **Possíveis causas**:
  - Regras de segurança do Firestore
  - Utilizador não autenticado
  - Problemas de conectividade

#### **E. Erros de Transcrição de Áudio**
- **Onde verificar**: `mobile/services/api.ts` → função `transcribeAudio`
- **Log**: `Error transcribing audio:`
- **Possíveis causas**:
  - API key do Groq inválida
  - Ficheiro de áudio corrompido
  - Formato de áudio não suportado

---

### 4. **Ferramentas Úteis para Debug**

#### **A. Adicionar Logs Temporários**
```typescript
// No ChatScreen.tsx, antes de enviar mensagem:
console.log('[CHAT DEBUG] Sending message:', textToSend);
console.log('[CHAT DEBUG] User context:', userContext);
console.log('[CHAT DEBUG] Rate limit check:', canSend);

// Depois de receber resposta:
console.log('[CHAT DEBUG] Raw response:', assistantContentRaw);
console.log('[CHAT DEBUG] Parsed meal:', mealSuggestion);
console.log('[CHAT DEBUG] Parsed exercise:', exerciseSuggestion);
```

#### **B. Verificar Dados no Firestore**
1. Vai ao Firebase Console
2. Navega para `messages` collection
3. Verifica se as mensagens estão a ser guardadas
4. Verifica se os campos estão corretos

#### **C. Verificar AsyncStorage**
```javascript
// No console do Metro:
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ver todas as chaves:
AsyncStorage.getAllKeys().then(keys => console.log('All keys:', keys));

// Ver rate limit específico:
AsyncStorage.getItem('chat_rate_limit_SEU_USER_ID').then(data => 
  console.log('Rate limit data:', data)
);
```

---

### 5. **Checklist de Testes**

Antes de fazer deploy, verifica:

- [ ] Utilizador free não consegue usar o chat
- [ ] Utilizador premium consegue usar o chat
- [ ] Rate limit funciona (5 mensagens/minuto)
- [ ] Mensagens são guardadas no Firestore
- [ ] Mensagens são carregadas ao abrir o chat
- [ ] Sugestões de refeição aparecem com botão "Adicionar Refeição"
- [ ] Sugestões de treino aparecem com botão "Adicionar Treino"
- [ ] JSON é parseado corretamente
- [ ] Nome da refeição/treino aparece em **negrito**
- [ ] Lista de alimentos aparece quando há sugestão de refeição
- [ ] Áudio é transcrito corretamente
- [ ] Erros são mostrados ao utilizador (toasts)
- [ ] Chat pode ser limpo
- [ ] Mensagens podem ser eliminadas
- [ ] Funciona offline (mensagens guardadas localmente até ter internet)

---

### 6. **Erros Comuns e Soluções**

#### **Erro: "Premium Necessário" mesmo sendo premium**
- **Causa**: `profile?.plan` não está a ser carregado corretamente
- **Solução**: Verifica se o perfil está a ser atualizado após upgrade

#### **Erro: Rate limit não funciona**
- **Causa**: AsyncStorage pode estar corrompido
- **Solução**: Limpa o AsyncStorage ou reinicia a app

#### **Erro: JSON não é parseado**
- **Causa**: IA não está a retornar JSON no formato correto
- **Solução**: Verifica os system prompts e ajusta se necessário

#### **Erro: Mensagens não aparecem**
- **Causa**: Regras de segurança do Firestore ou problema de conectividade
- **Solução**: Verifica regras do Firestore e conectividade

---

### 7. **Monitorização em Produção**

Para monitorizar erros em produção, considera:

1. **Sentry** ou **Bugsnag**: Para capturar erros automaticamente
2. **Firebase Analytics**: Para rastrear uso do chat
3. **Logs estruturados**: Para facilitar análise

---

## 🚀 Comandos Úteis

```bash
# Ver logs do Android
npx react-native log-android

# Ver logs do iOS
npx react-native log-ios

# Limpar cache do Metro
npx expo start --clear

# Limpar AsyncStorage (no código)
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.clear();
```

---

## 🧪 Testes Automatizados

### Executar Testes

```bash
# Executar todos os testes
npm test

# Executar apenas testes do chat
npm test -- chat.test.ts

# Executar testes em modo watch
npm run test:watch

# Executar testes com cobertura
npm run test:coverage
```

### Cobertura dos Testes Automatizados

Os testes automatizados (`mobile/__tests__/chat.test.ts`) cobrem:

- ✅ **Parsing de Sugestões** (17 testes)
  - Parsear sugestões de refeições e treinos
  - Validar campos obrigatórios
  - Remover unidades dos valores
  - Lidar com JSON mal formatado
  - Limpar resposta para exibição

- ✅ **Rate Limiting** (7 testes)
  - Permitir até 5 chamadas por minuto
  - Bloquear após limite
  - Remover timestamps antigos
  - Rate limit por utilizador

- ✅ **Validações** (2 testes)
  - Comprimento mínimo de mensagem
  - Mensagem não vazia

- ✅ **Funções de API** (3 testes)
  - Chamadas à API Groq
  - Tratamento de erros
  - Transcrição de áudio

- ✅ **Edge Cases** (5 testes)
  - JSON mal formatado
  - Respostas vazias
  - Caracteres especiais
  - Valores decimais

**Total: 34 testes automatizados**

Para mais detalhes, consulta `mobile/__tests__/README_CHAT_TESTS.md`.

