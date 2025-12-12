# Widgets Setup

Este documento explica como configurar e usar os widgets nativos do Nuti.

## Estrutura

### Android
- **WidgetProvider**: `android/app/src/main/java/com/nuti/app/widget/NutiWidgetProvider.kt`
- **Layout**: `android/app/src/main/res/layout/nuti_widget.xml`
- **Config**: `android/app/src/main/res/xml/nuti_widget_info.xml`
- **Módulo React Native**: `android/app/src/main/java/com/nuti/app/widget/WidgetModule.kt`

### iOS
- **Widget SwiftUI**: `ios/NutiWidget/NutiWidget.swift`
- **App Group**: `group.com.nuti.app` (configurado via config plugin)

## Como Funciona

1. **Compartilhamento de Dados**:
   - **Android**: Usa `SharedPreferences` com chave `nuti_widget_data`
   - **iOS**: Usa `UserDefaults` com App Group `group.com.nuti.app`

2. **Atualização Automática**:
   - O widget é atualizado automaticamente quando o `DashboardScreen` carrega ou atualiza dados
   - O serviço `widgetService.ts` gerencia a comunicação entre React Native e código nativo

3. **Dados Exibidos**:
   - Calorias consumidas vs. meta
   - Proteína, carboidratos e gordura (consumidos vs. metas)
   - Barras de progresso para cada macro

## Configuração

### Android

1. O widget já está configurado no `AndroidManifest.xml` via config plugin
2. O módulo React Native está registrado no `MainApplication.kt`
3. O layout e recursos estão em `res/`

### iOS

1. O App Group é configurado automaticamente via config plugin no `Info.plist`
2. O widget SwiftUI precisa ser adicionado ao projeto Xcode:
   - Abra o projeto no Xcode
   - Adicione um novo Target "Widget Extension"
   - Copie o código de `ios/NutiWidget/NutiWidget.swift`
   - Configure o App Group no target do widget

## Uso

O widget é atualizado automaticamente quando:
- O usuário adiciona/remove refeições
- O dashboard carrega dados
- Os macros são recalculados

Para atualizar manualmente:

```typescript
import { updateWidgetFromDashboard } from '../services/widgetService';

updateWidgetFromDashboard(
  consumed,    // calorias consumidas
  goal,        // meta de calorias
  macros,      // { protein, carbs, fat }
  profile      // perfil do usuário
);
```

## Build

### Android
```bash
npx expo prebuild --clean
npx expo run:android
```

### iOS
```bash
npx expo prebuild --clean
npx expo run:ios
```

**Nota**: Widgets requerem rebuild completo do app nativo.

## Testando

### Android
1. Build e instale o app
2. Adicione o widget à tela inicial (long press > Widgets > Nuti)
3. Verifique se os dados aparecem corretamente

### iOS
1. Build e instale o app
2. Adicione o widget à tela inicial (long press > + > Nuti)
3. Verifique se os dados aparecem corretamente

## Troubleshooting

### Widget não atualiza
- Verifique se o módulo nativo está registrado corretamente
- Confirme que os dados estão sendo salvos no SharedPreferences/UserDefaults
- Verifique os logs do console para erros

### Widget não aparece
- Certifique-se de que fez rebuild completo do app
- Verifique se o widget está configurado no AndroidManifest.xml (Android)
- Verifique se o App Group está configurado (iOS)

### Dados incorretos
- Verifique se o `DashboardScreen` está chamando `updateWidgetFromDashboard`
- Confirme que os dados estão sendo calculados corretamente



