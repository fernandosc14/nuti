# Testes Automatizados

Este diretório contém testes automatizados para validar a funcionalidade de extração de dados nutricionais e cálculo do health score.

## Instalação

Primeiro, instale as dependências de teste:

```bash
cd mobile
npm install
```

## Executar Testes

### Executar todos os testes
```bash
npm test
```

### Executar testes em modo watch (re-executa quando arquivos mudam)
```bash
npm run test:watch
```

### Executar testes com cobertura de código
```bash
npm run test:coverage
```

## Estrutura dos Testes

### `api.nutrition.test.ts`
Testa a extração de dados nutricionais do Open Food Facts:
- ✅ Extração de dados básicos (calorias, proteína, carboidratos, gordura)
- ✅ Extração de dados adicionais (açúcares, fibra, sódio, gordura saturada, gordura trans)
- ✅ Conversão de sal para sódio
- ✅ Validação de tipos e valores
- ✅ Tratamento de campos ausentes

### `healthScore.test.ts`
Testa o cálculo do health score:
- ✅ Cálculo básico do score
- ✅ Penalizações por calorias excessivas
- ✅ Consideração de açúcares no cálculo
- ✅ Bonus por alta fibra
- ✅ Penalizações por alto sódio
- ✅ Penalizações por gordura saturada alta
- ✅ Penalização severa por gordura trans
- ✅ Compatibilidade sem dados adicionais
- ✅ Normalização do score (0-10)

## O que os testes verificam

1. **Extração correta de dados**: Verifica se todos os campos nutricionais são extraídos corretamente do formato Open Food Facts
2. **Conversões**: Testa a conversão de sal para sódio (1g sal = 400mg sódio)
3. **Valores opcionais**: Verifica que campos undefined não são incluídos quando dados não estão disponíveis
4. **Cálculo do score**: Valida que o health score é calculado corretamente usando os dados adicionais
5. **Sugestões**: Verifica que sugestões apropriadas são geradas baseadas nos dados nutricionais

## Exemplo de Saída

```
PASS  __tests__/api.nutrition.test.ts
  Extração de Dados Nutricionais
    ✓ deve extrair todos os dados nutricionais básicos
    ✓ deve extrair dados nutricionais adicionais quando disponíveis
    ✓ deve converter sal para sódio corretamente
    ✓ deve extrair gordura trans quando presente
    ✓ não deve incluir campos undefined quando dados não estão disponíveis

PASS  __tests__/healthScore.test.ts
  Cálculo do Health Score
    ✓ deve calcular score básico corretamente
    ✓ deve penalizar refeições muito calóricas
    ✓ deve considerar açúcares no cálculo quando disponível
    ✓ deve dar bonus por alta fibra quando disponível
    ✓ deve penalizar alto sódio quando disponível

Test Suites: 2 passed, 2 total
Tests:       15 passed, 15 total
```

## Adicionar Novos Testes

Para adicionar novos testes, crie um arquivo `*.test.ts` no diretório `__tests__` seguindo o padrão:

```typescript
describe('Nome do Grupo de Testes', () => {
  test('deve fazer algo específico', () => {
    // Arrange
    const input = ...;
    
    // Act
    const result = functionToTest(input);
    
    // Assert
    expect(result).toBe(expected);
  });
});
```

