#!/bin/bash
# Script para obter SHA-1 do keystore Android (Linux/Mac)
# Uso: ./get-sha1.sh

echo "🔍 Obtendo SHA-1 do keystore de debug..."
echo ""

KEYSTORE_PATH="app/debug.keystore"

if [ ! -f "$KEYSTORE_PATH" ]; then
    echo "❌ Erro: Keystore não encontrado em $KEYSTORE_PATH"
    echo "O keystore será criado automaticamente na primeira build."
    exit 1
fi

SHA1=$(keytool -list -v -keystore "$KEYSTORE_PATH" -alias androiddebugkey -storepass android -keypass android 2>/dev/null | grep "SHA1:" | awk '{print $2}')

if [ -z "$SHA1" ]; then
    echo "❌ Erro ao obter SHA-1. Certifica-te que o Java JDK está instalado."
    exit 1
fi

echo "✅ SHA-1 encontrado:"
echo ""
echo "$SHA1"
echo ""
echo "📋 Copia este SHA-1 e cola no Google Cloud Console:"
echo "   1. Vai a https://console.cloud.google.com/"
echo "   2. APIs & Services > Credentials"
echo "   3. Cria um OAuth 2.0 Client ID (tipo Android)"
echo "   4. Package name: com.nuti.app"
echo "   5. SHA-1: $SHA1"
echo ""

# Tentar copiar para clipboard (Linux)
if command -v xclip &> /dev/null; then
    echo "$SHA1" | xclip -selection clipboard
    echo "✅ SHA-1 copiado para a área de transferência!"
elif command -v pbcopy &> /dev/null; then
    echo "$SHA1" | pbcopy
    echo "✅ SHA-1 copiado para a área de transferência!"
else
    echo "💡 Dica: Seleciona e copia o SHA-1 acima manualmente"
fi

