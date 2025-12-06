# Como Testar Badges

## 🎯 Método Mais Rápido: Primeira Refeição

### Passo 1: Remover a badge do teu perfil
1. Vai ao **Firebase Console** > **Firestore**
2. Abre o documento do utilizador: `users/{seuUserId}`
3. Encontra o campo `badges` (array)
4. Remove `first_meal` do array (se existir)
5. Salva

### Passo 2: Adicionar uma refeição
1. Na app, vai ao **Dashboard**
2. Clica em **"+"** para adicionar refeição
3. Adiciona qualquer refeição
4. **O modal de badge deve aparecer automaticamente!** 🎉

---

## 🧪 Método Alternativo: Modificar Temporariamente o Código

Se quiseres testar badges que requerem mais ações (ex: 10 refeições), podes temporariamente modificar os requisitos:

### Exemplo: Testar badge "10 Refeições" com apenas 1 refeição

1. Abre `mobile/services/gamification.ts`
2. Encontra a linha:
   ```typescript
   case 'meals_10':
     shouldAward = mealCount >= 10;
     break;
   ```
3. Muda temporariamente para:
   ```typescript
   case 'meals_10':
     shouldAward = mealCount >= 1; // Temporário para teste
     break;
   ```
4. Salva e recarrega a app
5. Adiciona uma refeição
6. A badge deve aparecer!
7. **IMPORTANTE**: Volta a mudar para `>= 10` depois do teste!

---

## 📋 Checklist de Teste por Badge

### ✅ Badge: "First Meal" (Primeira Refeição)
- **Requisito**: 1 refeição
- **Como testar**: 
  1. Remove `first_meal` do array `badges` no Firestore
  2. Adiciona uma refeição
  3. Modal deve aparecer

### ✅ Badge: "10 Meals" (10 Refeições)
- **Requisito**: 10 refeições totais
- **Como testar**: 
  1. Verifica quantas refeições tens (Firestore > `meals` collection)
  2. Se tiveres menos de 10, adiciona refeições até chegar a 10
  3. Ou modifica temporariamente o código para `>= 1`

### ✅ Badge: "First Exercise" (Primeiro Exercício)
- **Requisito**: 1 exercício
- **Como testar**: 
  1. Remove `first_exercise` do array `badges` (se existir)
  2. Adiciona um exercício
  3. Modal deve aparecer

### ✅ Badge: "Goal Achieved" (Meta Atingida)
- **Requisito**: Calorias consumidas >= meta de calorias
- **Como testar**: 
  1. Verifica a tua meta de calorias no Dashboard
  2. Adiciona refeições até atingires ou ultrapassares a meta
  3. Modal deve aparecer automaticamente

### ✅ Badge: "3 Day Streak" (3 Dias Seguidos)
- **Requisito**: 3 dias consecutivos com refeições
- **Como testar**: 
  1. Adiciona uma refeição hoje
  2. Muda a data do sistema para amanhã (ou usa a funcionalidade de selecionar data)
  3. Adiciona uma refeição
  4. Repete por mais 1 dia
  5. Modal deve aparecer

---

## 🔍 Verificar se Funcionou

### No Firestore:
1. Vai ao documento do utilizador: `users/{userId}`
2. Verifica o campo `badges` (array)
3. Deve conter o ID da badge ganha (ex: `first_meal`)

### Na App:
1. Vai ao **Progress** (ícone de gráfico)
2. Deves ver o card de badges no final
3. A badge ganha deve aparecer lá

### Modal:
- Deve aparecer automaticamente quando ganhas uma badge
- Fecha automaticamente após 3 segundos
- Podes fechar manualmente tocando fora

---

## 🐛 Troubleshooting

### Modal não aparece
- **Verifica**: Se já tens a badge (vai ao Firestore e vê o array `badges`)
- **Solução**: Remove a badge do array e testa novamente

### Badge não é atribuída
- **Verifica**: Se os requisitos estão corretos (ex: mealCount >= 10)
- **Verifica**: Se as badges existem no Firestore (coleção `badges`)
- **Solução**: Cria as badges manualmente no Firestore se não existirem

### Badge aparece múltiplas vezes
- **Verifica**: Se o hook `useBadgeNotification` está a ser chamado múltiplas vezes
- **Solução**: O código já previne isso, mas se acontecer, verifica os logs

---

## 💡 Dica Rápida

**A forma mais rápida de testar:**
1. Remove `first_meal` do array `badges` no Firestore
2. Adiciona uma refeição na app
3. Modal aparece imediatamente! ✅

---

## 📝 Notas

- As badges são verificadas automaticamente quando:
  - Adicionas uma refeição
  - Adicionas água (para badge de água)
  - Atinges a meta de calorias
  - Atualizas o streak

- O modal só aparece para **badges novas** (que ainda não tinhas)

- Se já tiveres uma badge, ela não aparece novamente no modal

