# Guia de Distribuição para Testes

## Opção 1: Build de Desenvolvimento (Recomendado)

### Pré-requisitos:
1. Conta no Expo (gratuita)
2. EAS CLI instalado

### Passos:

1. **Instalar EAS CLI** (se ainda não tiver):
```bash
npm install -g eas-cli
```

2. **Fazer login no Expo**:
```bash
eas login
```

3. **Gerar build de desenvolvimento para Android**:
```bash
cd mobile
npm run eas:build:dev
```

4. **Aguardar o build** (pode demorar 10-20 minutos na primeira vez)

5. **Partilhar o link**:
   - Após o build, o EAS fornece um link de download
   - Partilha esse link com a pessoa que vai testar
   - Ela pode baixar e instalar o APK diretamente

### Para iOS:
```bash
eas build --platform ios --profile development
```
(Requer conta Apple Developer)

---

## Opção 2: Expo Go (Rápido, mas limitado)

### Passos:

1. **Iniciar o servidor de desenvolvimento**:
```bash
cd mobile
npm start
```

2. **Partilhar o QR Code ou link**:
   - A pessoa instala o app "Expo Go" na Play Store / App Store
   - Escaneia o QR code ou abre o link
   - O app carrega no Expo Go

### Limitações:
- Algumas funcionalidades nativas podem não funcionar
- Requer conexão à internet
- Performance pode ser diferente

---

## Opção 3: Build de Produção (Para testes mais próximos da versão final)

### Android:
```bash
cd mobile
eas build --platform android --profile production
```

### iOS:
```bash
eas build --platform ios --profile production
```

---

## Notas Importantes:

1. **Primeira vez**: O primeiro build pode demorar mais (cria o ambiente)
2. **Variáveis de ambiente**: Certifica-te de que as variáveis do Firebase estão configuradas
3. **Permissões**: O testador precisa permitir instalação de apps de fontes desconhecidas (Android)
4. **Assinatura**: Para iOS, precisas de uma conta Apple Developer ($99/ano)

---

## Troubleshooting:

- **Erro de autenticação**: Verifica `eas login`
- **Erro de build**: Verifica os logs no dashboard do Expo
- **APK não instala**: Verifica se o testador permitiu "Fontes desconhecidas"

