// Configuração global para testes
// Mock de módulos nativos se necessário

// Mock do fetch global
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    })
  );
}

// Limpar mocks entre testes
beforeEach(() => {
  jest.clearAllMocks();
});

