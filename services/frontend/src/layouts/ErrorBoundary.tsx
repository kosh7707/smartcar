import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        <div className="flex flex-col items-center justify-center gap-5 px-6 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle size={24} />
          </div>
          <h2 className="m-0 text-lg font-semibold text-foreground">
            페이지를 표시할 수 없습니다
          </h2>
          <p className="m-0 max-w-[400px] text-base leading-relaxed text-muted-foreground">
            예기치 않은 오류가 발생했습니다. 새로고침을 시도해 주세요.
          </p>
          <Button
            className="gap-3"
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
