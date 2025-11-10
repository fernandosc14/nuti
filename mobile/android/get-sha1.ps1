# Script PowerShell para obter SHA-1 do keystore Android
# Uso: .\get-sha1.ps1

Write-Host "🔍 Obtendo SHA-1 do keystore de debug..." -ForegroundColor Cyan
Write-Host ""

$keystorePath = Join-Path $PSScriptRoot "app\debug.keystore"

if (-not (Test-Path $keystorePath)) {
    Write-Host "❌ Erro: Keystore não encontrado em $keystorePath" -ForegroundColor Red
    Write-Host "O keystore será criado automaticamente na primeira build." -ForegroundColor Yellow
    exit 1
}

try {
    $output = & keytool -list -v -keystore $keystorePath -alias androiddebugkey -storepass android -keypass android 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao executar keytool. Certifica-te que o Java JDK está instalado." -ForegroundColor Red
        exit 1
    }
    
    $sha1Line = $output | Select-String "SHA1:"
    
    if ($sha1Line) {
        $sha1 = ($sha1Line -split "SHA1:")[1].Trim()
        Write-Host "✅ SHA-1 encontrado:" -ForegroundColor Green
        Write-Host ""
        Write-Host $sha1 -ForegroundColor Yellow
        Write-Host ""
        Write-Host "📋 Copia este SHA-1 e cola no Google Cloud Console:" -ForegroundColor Cyan
        Write-Host "   1. Vai a https://console.cloud.google.com/" -ForegroundColor White
        Write-Host "   2. APIs & Services > Credentials" -ForegroundColor White
        Write-Host "   3. Cria um OAuth 2.0 Client ID (tipo Android)" -ForegroundColor White
        Write-Host "   4. Package name: com.nuti.app" -ForegroundColor White
        Write-Host "   5. SHA-1: $sha1" -ForegroundColor White
        Write-Host ""
        
        # Copiar para clipboard se possível
        try {
            $sha1 | Set-Clipboard
            Write-Host "✅ SHA-1 copiado para a área de transferência!" -ForegroundColor Green
        } catch {
            Write-Host "💡 Dica: Seleciona e copia o SHA-1 acima manualmente" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ SHA-1 não encontrado no output" -ForegroundColor Red
        Write-Host "Output completo:" -ForegroundColor Yellow
        Write-Host $output
    }
} catch {
    Write-Host "❌ Erro: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Certifica-te que:" -ForegroundColor Yellow
    Write-Host "   - Java JDK está instalado" -ForegroundColor White
    Write-Host "   - keytool está no PATH" -ForegroundColor White
}

