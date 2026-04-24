import React from "react";

import Button from "./ui/Button.jsx";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "", stack: "" };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("StudyGenie UI error", error);
    this.setState({
      message: error?.message ?? "Unknown UI error",
      stack: info?.componentStack ?? "",
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="page-shell">
          <div className="app-error-card">
            <p className="eyebrow">Interface Error</p>
            <h2>Something went wrong on this screen.</h2>
            <p className="muted-copy">
              Refresh the page and try again. If the issue happens again after OCR, the app will
              now stay visible so we can narrow it down safely.
            </p>
            {this.state.message ? (
              <pre className="app-error-copy">{this.state.message}</pre>
            ) : null}
            {this.state.stack ? (
              <pre className="app-error-copy">{this.state.stack}</pre>
            ) : null}
            <Button onClick={() => window.location.reload()}>Reload page</Button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
