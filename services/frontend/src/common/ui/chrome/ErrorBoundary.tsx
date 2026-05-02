import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import "./ErrorBoundary.css";

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
        <div className="error-boundary">
          <div className="error-boundary__icon-shell">
            <AlertTriangle size={24} aria-hidden="true" />
          </div>
          <h2 className="error-boundary__title">페이지를 표시할 수 없습니다</h2>
          <p className="error-boundary__description">
            예기치 않은 오류가 발생했습니다. 새로고침을 시도해 주세요.
          </p>
          <button
            type="button"
            className="btn btn-primary error-boundary__action"
            onClick={this.handleReload}
          >
            <RefreshCw size={14} aria-hidden="true" />
            새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
