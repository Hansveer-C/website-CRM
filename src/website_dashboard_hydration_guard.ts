export interface ProtectedAsyncOperationToken {
  runtimeGeneration: number;
  operationGeneration: number;
  scope: string;
  userId: string;
}

export class SupersededOperationError extends Error {
  constructor() {
    super('SUPERSEDED');
    this.name = 'SupersededOperationError';
  }
}

export function isSupersededOperationError(error: unknown): error is SupersededOperationError {
  return error instanceof SupersededOperationError;
}

export class ProtectedAsyncOperationGuard {
  private runtimeGeneration = 0;
  private readonly operationGenerations = new Map<string, number>();

  begin(scope: string, userIdInput: string): ProtectedAsyncOperationToken {
    const operationGeneration = (this.operationGenerations.get(scope) ?? 0) + 1;
    this.operationGenerations.set(scope, operationGeneration);
    return {
      runtimeGeneration: this.runtimeGeneration,
      operationGeneration,
      scope,
      userId: userIdInput.trim()
    };
  }

  invalidateRuntime(): void {
    this.runtimeGeneration += 1;
    this.operationGenerations.clear();
  }

  invalidateScope(scope: string): void {
    this.operationGenerations.set(scope, (this.operationGenerations.get(scope) ?? 0) + 1);
  }

  isCurrent(token: ProtectedAsyncOperationToken, currentUserIdInput: string): boolean {
    return token.runtimeGeneration === this.runtimeGeneration
      && token.operationGeneration === this.operationGenerations.get(token.scope)
      && token.userId === currentUserIdInput.trim();
  }

  commitIfCurrent(token: ProtectedAsyncOperationToken, currentUserIdInput: string, commit: () => void): boolean {
    if (!this.isCurrent(token, currentUserIdInput)) return false;
    commit();
    return true;
  }

  requireCurrent(token: ProtectedAsyncOperationToken, currentUserIdInput: string): void {
    if (!this.isCurrent(token, currentUserIdInput)) throw new SupersededOperationError();
  }
}
