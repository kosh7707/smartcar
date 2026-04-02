declare namespace Express {
  interface Request {
    requestId: string;
    user?: {
      id: string;
      username: string;
      displayName: string;
      role: "viewer" | "analyst" | "admin";
    };
  }
}
