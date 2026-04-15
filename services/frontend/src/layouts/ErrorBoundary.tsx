import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
          <div className="error-boundary__icon">
            <AlertTriangle size={24} />
          </div>
          <h2 className="error-boundary__title">
            페이지를 표시할 수 없습니다
          </h2>
          <p className="error-boundary__text">
            예기치 않은 오류가 발생했습니다. 새로고침을 시도해 주세요.
          </p>
          <Button
            className="error-boundary__btn"
            onClick={this.handleReload}
          >
            <RefreshCw size={14} />
            새로고침
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
