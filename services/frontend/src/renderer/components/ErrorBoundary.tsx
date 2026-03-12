import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-4)",
          padding: "var(--space-16) var(--space-6)",
          textAlign: "center",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: "var(--radius-lg)",
            background: "var(--severity-high-bg)",
            color: "var(--severity-high)",
          }}>
            <AlertTriangle size={24} />
          </div>
          <h2 style={{
            fontSize: "var(--text-lg)",
            fontWeight: "var(--weight-semibold)" as any,
            color: "var(--text-primary)",
            margin: 0,
          }}>
            페이지를 표시할 수 없습니다
          </h2>
          <p style={{
            fontSize: "var(--text-base)",
            color: "var(--text-tertiary)",
            margin: 0,
            maxWidth: 400,
            lineHeight: "var(--leading-relaxed)",
          }}>
            예기치 않은 오류가 발생했습니다. 새로고침을 시도해 주세요.
          </p>
          <button
            className="btn btn-primary"
            onClick={this.handleReload}
            style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
          >
            <RefreshCw size={14} />
            새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
