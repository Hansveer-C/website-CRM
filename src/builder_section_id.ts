export function createBuilderSectionId(randomUUID: () => string = () => crypto.randomUUID()): string {
  return `sec-${randomUUID()}`;
}
