export class OutfitImageProviderError extends Error {
  constructor(provider: string, detail: string) {
    super(`[${provider}] ${detail}`);
    this.name = "OutfitImageProviderError";
  }
}
