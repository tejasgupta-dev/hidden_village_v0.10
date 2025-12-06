import React, { StrictMode, Suspense } from "react";
import { render } from "react-dom";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import Loader from "./components/utilities/Loader.js";
import Settings from "./components/Settings.js";
import * as PIXI from "pixi.js";
import "regenerator-runtime/runtime";

// This global declaration is necessary to make the chrome PIXI devtools work
window.PIXI = PIXI;
import Sandbox from "./components/Sandbox";
import PoseCapture from "./components/PoseCapture";
import SignIn from "./components/auth/SignIn";
// Temporarily remove lazy loading to test
import Story from "./components/Story";

// Firebase Init
import { app } from "./firebase/init";

const { NODE_ENV } = process.env;

// Debug logging
console.log('[App] Initializing...', {
  NODE_ENV,
  hasApp: !!app,
  appId: app?.options?.projectId
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[App] ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.toString()}</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => {
  console.log('[App] Component rendering...');
  
  return (
    <ErrorBoundary>
      <Router>
        <Switch>
          {NODE_ENV !== "production" && (
            <Route path="/sandbox">
              <Sandbox />
            </Route>
          )}
          {NODE_ENV !== "production" && (
            <Route path="/posecapture">
              <PoseCapture />
            </Route>
          )}
          <Route path="/settings">
            <Settings />
          </Route>
          <Route path="/signin">
            <SignIn firebaseApp={app} />
          </Route>
          <Route path="/">
            <Story />
          </Route>
        </Switch>
      </Router>
    </ErrorBoundary>
  );
};

console.log('[App] About to render to DOM...');
render(
  <StrictMode>
    <App />
  </StrictMode>,
  document.getElementById("root")
);
