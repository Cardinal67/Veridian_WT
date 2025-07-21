import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * This is the main entry point for the React application.
 * It's responsible for finding the root HTML element and rendering the
 * main `App` component into it.
 */

// 1. Get the root DOM element.
// The `index.html` file has a `<div id="root"></div>`. This is the container
// where our entire React application will live.
const rootElement = document.getElementById('root');

// 2. A safety check to ensure the root element exists.
// If it doesn't, the app can't render, so we throw an error.
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// 3. Create a React "root".
// This is the modern way (React 18+) to manage rendering. It enables
// concurrent features and provides a more ergonomic API than the old `ReactDOM.render`.
const root = ReactDOM.createRoot(rootElement);

// 4. Render the application.
// We tell the root to render our main `App` component.
// `<React.StrictMode>` is a wrapper that helps find potential problems in an app.
// It activates additional checks and warnings for its descendants. It only runs in
// development mode and does not affect the production build.
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);