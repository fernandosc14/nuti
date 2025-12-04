# Nuti Cloud Functions

Cloud Functions para operações server-side do Nuti, incluindo envio de emails.

## 📋 Pré-requisitos

1. **Node.js 18+** instalado
2. **Firebase CLI** instalado globalmente:
   ```bash
   npm install -g firebase-tools
   ```
3. **Resend API Key** - Criar conta em [resend.com](https://resend.com) e obter API key

## 🚀 Configuração

1. **Instalar dependências:**
   ```bash
   cd functions
   npm install
   ```

2. **Configurar variáveis de ambiente no Firebase:**
   ```bash
   firebase functions:config:set resend.api_key="your-resend-api-key"
   ```
   
   Ou usando a nova sintaxe (Firebase CLI 10+):
   ```bash
   firebase functions:secrets:set RESEND_API_KEY
   ```
   (Vai pedir para inserir o valor)

3. **Verificar domínio no Resend:**
   - Aceder a [resend.com/domains](https://resend.com/domains)
   - Adicionar e verificar o domínio `nuti.app`
   - Configurar DNS records conforme instruções

## 🔨 Desenvolvimento

1. **Compilar TypeScript:**
   ```bash
   npm run build
   ```

2. **Executar emulador local (opcional):**
   ```bash
   npm run serve
   ```

3. **Ver logs:**
   ```bash
   npm run logs
   ```

## 📤 Deploy

1. **Fazer login no Firebase:**
   ```bash
   firebase login
   ```

2. **Deploy das functions:**
   ```bash
   npm run deploy
   ```
   
   Ou a partir da raiz do projeto:
   ```bash
   firebase deploy --only functions
   ```

## 📧 Funções Disponíveis

### `sendAccountDeletionEmail`
Função callable que envia email de confirmação de exclusão de conta.

**Parâmetros:**
- `email` (string, obrigatório): Email do utilizador
- `userName` (string, opcional): Nome do utilizador

**Retorno:**
- `success` (boolean): Se o email foi enviado com sucesso
- `messageId` (string): ID da mensagem no Resend

**Exemplo de uso no cliente:**
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const sendDeletionEmail = httpsCallable(functions, 'sendAccountDeletionEmail');

await sendDeletionEmail({
  email: 'user@example.com',
  userName: 'John Doe',
});
```

## 🔐 Segurança

- A função verifica autenticação do utilizador
- Apenas utilizadores autenticados podem chamar a função
- O email é enviado apenas para o email do utilizador autenticado

## 📝 Notas

- O domínio `hello@nuti.app` deve estar verificado no Resend
- Para produção, configurar variáveis de ambiente via Firebase Functions config
- O Resend tem um free tier generoso (3000 emails/mês)

