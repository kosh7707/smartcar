interface SmartcarApi {
  backendUrl?: string;
  healthCheck?: () => Promise<unknown>;
}

interface Window {
  api?: SmartcarApi;
}
