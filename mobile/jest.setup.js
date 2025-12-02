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

// Mock do FormData para testes de transcrição de áudio
global.FormData = class FormData {
  append(key, value) {
    this[key] = value;
  }
};

// Mock de console.error para evitar logs desnecessários nos testes
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

// Limpar mocks entre testes
beforeEach(() => {
  jest.clearAllMocks();
});

