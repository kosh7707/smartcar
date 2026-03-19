interface AegisApi {
  backendUrl?: string;
  healthCheck?: () => Promise<unknown>;
}

interface Window {
  api?: AegisApi;
}
