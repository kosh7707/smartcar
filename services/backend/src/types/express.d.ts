declare namespace Express {
  interface Request {
    requestId: string;
    user?: {
      id: string;
      username: string;
      email?: string;
      displayName: string;
      role: "viewer" | "analyst" | "admin";
      accountStatus?: "active" | "disabled";
      organizationId?: string | null;
      organizationCode?: string | null;
      organizationName?: string | null;
    };
  }
}
