export interface WebsiteDashboardHydrationToken {
  generation: number;
  userId: string;
}

export class WebsiteDashboardHydrationGuard {
  private generation = 0;

  begin(userIdInput: string): WebsiteDashboardHydrationToken {
    return {
      generation: ++this.generation,
      userId: userIdInput.trim()
    };
  }

  invalidate(): void {
    this.generation += 1;
  }

  commitIfCurrent(token: WebsiteDashboardHydrationToken, currentUserIdInput: string, commit: () => void): boolean {
    if (token.generation !== this.generation || token.userId !== currentUserIdInput.trim()) return false;
    commit();
    return true;
  }
}
