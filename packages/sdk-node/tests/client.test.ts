import { ControlPlane } from '../src/index.js';

describe('ControlPlane Node.js SDK Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should initialize successfully with parameters', () => {
    const client = new ControlPlane({
      apiKey: 'cp_test_tenant_nodejs',
      baseURL: 'http://localhost:5000/v1',
    });

    expect(client.apiKey).toBe('cp_test_tenant_nodejs');
    expect(client.baseURL).toBe('http://localhost:5000/v1/');
  });

  test('should fallback to environment variables', () => {
    process.env.CONTROLPLANE_API_KEY = 'cp_test_tenant_env';
    process.env.CONTROLPLANE_GATEWAY_URL = 'http://env-gateway:3000/v1';

    const client = new ControlPlane();
    expect(client.apiKey).toBe('cp_test_tenant_env');
    expect(client.baseURL).toBe('http://env-gateway:3000/v1/');
  });

  test('should throw error when API key is missing', () => {
    delete process.env.CONTROLPLANE_API_KEY;

    expect(() => {
      new ControlPlane();
    }).toThrow('Missing ControlPlane API key');
  });
});
