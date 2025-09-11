import { AuthenticationService } from '../../src/services/AuthenticationService.js';

describe('AuthenticationService', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthenticationService();
  });

  test('should generate valid tokens', async () => {
    const token = await authService.generateToken('user123');
    expect(await authService.validateToken(token)).toBe(true);
  });

  test('should revoke tokens', async () => {
    const token = await authService.generateToken('user123');
    await authService.revokeToken(token);
    expect(await authService.validateToken(token)).toBe(false);
  });
});
