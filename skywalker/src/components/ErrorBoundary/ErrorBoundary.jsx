import { Component } from "react";

/**
 * Contains a render/effect crash to one subtree. Without it, any throw (e.g.
 * WebGL unavailable on the device) unmounts the whole app to a white page.
 * `resetKey` changing (e.g. the route) gives the subtree another try.
 */
export default class ErrorBoundary extends Component {
  state = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error, info) {
    console.error(error, info.componentStack);
  }

  render() {
    return this.state.error ? this.props.fallback ?? null : this.props.children;
  }
}
