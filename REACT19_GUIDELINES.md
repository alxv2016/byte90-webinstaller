# React 19 Guidelines for BYTE-90 Web Installer

## Overview

This project uses React 19.1.0 and follows React 19 best practices and patterns.

## Key React 19 Features We're Using

### 1. Type Imports

Always use type-only imports for TypeScript types:

```tsx
// ✅ Correct
import { type ReactNode } from 'react';
import { type ComponentProps } from 'react';

// ❌ Avoid
import React, { ReactNode } from 'react';
```

### 2. Component Props Pattern

Use the `BaseComponentProps` interface for consistent component props:

```tsx
import { type BaseComponentProps } from '../utils/react19-utils';

interface MyComponentProps extends BaseComponentProps {
  // Your specific props
  title: string;
  onAction: () => void;
}
```

### 3. Event Handlers

Use the `EventHandler` type for type-safe event handling:

```tsx
import { type EventHandler } from '../utils/react19-utils';

const handleClick: EventHandler<MouseEvent> = event => {
  // Handle click
};
```

### 4. Async State Management

Use the `AsyncState` pattern for data fetching:

```tsx
import { createAsyncState } from '../utils/react19-utils';

const [deviceData, setDeviceData] = useState(createAsyncState<DeviceInfo>());
```

### 5. Conditional Rendering

Use the `Conditional` component for clean conditional rendering:

```tsx
import { Conditional } from '../utils/react19-utils';

<Conditional condition={isConnected} fallback={<DisconnectedState />}>
  <ConnectedState />
</Conditional>;
```

## Hooks Best Practices

### useState

- Use explicit typing for complex state
- Prefer object state over multiple primitive states

```tsx
// ✅ Good
const [state, setState] = useState<ComplexState>({
  loading: false,
  data: null,
  error: null,
});

// ❌ Avoid multiple primitive states
const [loading, setLoading] = useState(false);
const [data, setData] = useState(null);
const [error, setError] = useState(null);
```

### useCallback

- Use for event handlers and functions passed as props
- Include all dependencies in the dependency array

```tsx
const handleConnect = useCallback(async () => {
  try {
    await serial.connect();
  } catch (error) {
    console.error('Connection failed:', error);
  }
}, [serial.connect]);
```

### useEffect

- Use for side effects only
- Clean up subscriptions and event listeners

```tsx
useEffect(() => {
  const handleVisibilityChange = () => {
    // Handle visibility change
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, []);
```

## Component Structure

### Functional Components

```tsx
import { type ReactNode } from 'react';
import { type BaseComponentProps } from '../utils/react19-utils';

interface MyComponentProps extends BaseComponentProps {
  title: string;
  children: ReactNode;
}

export default function MyComponent({
  title,
  children,
  className,
  'data-testid': testId,
}: MyComponentProps) {
  return (
    <div className={className} data-testid={testId}>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
```

### Custom Hooks

```tsx
import { useState, useCallback, useEffect } from 'react';
import { type EventHandler } from '../utils/react19-utils';

interface UseMyHookOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useMyHook(options: UseMyHookOptions = {}) {
  const [state, setState] = useState(createAsyncState<MyData>());

  const handleAction = useCallback(async () => {
    // Implementation
  }, [options.onSuccess, options.onError]);

  return {
    state,
    handleAction,
  };
}
```

## Performance Optimizations

### 1. Memoization

Use `useMemo` for expensive calculations:

```tsx
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);
```

### 2. Component Memoization

Use `React.memo` for components that receive stable props:

```tsx
const MyComponent = React.memo(function MyComponent({ data }: Props) {
  return <div>{data}</div>;
});
```

### 3. Lazy Loading

Use `React.lazy` for code splitting:

```tsx
const LazyComponent = React.lazy(() => import('./LazyComponent'));

// Wrap in Suspense
<Suspense fallback={<Loading />}>
  <LazyComponent />
</Suspense>;
```

## Error Boundaries

Implement error boundaries for better error handling:

```tsx
import { Component, type ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong.</div>;
    }

    return this.props.children;
  }
}
```

## Testing Considerations

### Component Testing

- Use `data-testid` attributes for reliable testing
- Test component behavior, not implementation details
- Mock external dependencies

### Hook Testing

- Test custom hooks in isolation
- Use `@testing-library/react-hooks` for hook testing
- Test error states and edge cases

## Future React 19 Features to Consider

### 1. use() Hook

When available, use the `use` hook for data fetching:

```tsx
import { use } from 'react';

function MyComponent() {
  const data = use(fetchData());
  return <div>{data}</div>;
}
```

### 2. Document Metadata

Use React 19's document metadata features:

```tsx
import { use } from 'react';

function MyComponent() {
  use((document.title = 'BYTE-90 Device Manager'));
  // Component logic
}
```

### 3. Concurrent Features

Take advantage of concurrent rendering features when they become stable.

## Code Review Checklist

- [ ] Uses type-only imports for TypeScript types
- [ ] Follows `BaseComponentProps` pattern
- [ ] Proper error handling in async operations
- [ ] Cleanup in useEffect hooks
- [ ] Proper dependency arrays in useCallback/useMemo
- [ ] Accessible components with proper ARIA attributes
- [ ] Performance optimizations where appropriate
- [ ] Consistent naming conventions
- [ ] Proper TypeScript typing

## Resources

- [React 19 Documentation](https://react.dev/)
- [React 19 Migration Guide](https://react.dev/learn/upgrading)
- [TypeScript with React](https://www.typescriptlang.org/docs/handbook/react.html)
