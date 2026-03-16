import { NavigationContainer, DefaultTheme as NavDefaultTheme } from "@react-navigation/native"
import { PaperProvider } from "react-native-paper"
import { AppProvider } from "./src/context/AppContext"
import { LocationProvider } from "./src/context/LocationContext"
import { PathDeviationProvider } from "./src/context/PathDeviationContext"
import { RootNavigator } from "./src/navigation"
import { paperTheme } from "./src/theme/paper"
import ToastListener from './src/components/ToastListener'
import { StatusBar } from "expo-status-bar"
import { useEffect, useState } from "react"
import * as SplashScreen from "expo-splash-screen"
import { View, Text, ActivityIndicator } from "react-native"
import React from "react"
import { configureNotificationHandler } from "./src/utils/notificationsCompat"
import * as Sentry from "@sentry/react-native"

Sentry.init({
  dsn: "https://f11af5eb8d307747f6863fc91cfaf82a@o4510890860740608.ingest.us.sentry.io/4510890863558656",
  debug: false,
  enableLogs: true,
  logsOrigin: 'all',
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,
  enableNativeCrashHandling: true,
  enableAutoPerformanceTracing: true,
  tracesSampleRate: 1.0,
  attachStacktrace: true,
  enableCaptureFailedRequests: true,
  beforeBreadcrumb(breadcrumb, hint) {
    return breadcrumb;
  },
  beforeSend(event, hint) {
    return event;
  },
})
SplashScreen.preventAutoHideAsync()

// Manually capture console logs for Sentry
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = (...args) => {
  originalConsoleLog(...args);
  Sentry.logger.info(args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' '));
};

console.warn = (...args) => {
  originalConsoleWarn(...args);
  Sentry.logger.warn(args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' '));
};

console.error = (...args) => {
  originalConsoleError(...args);
  Sentry.logger.error(args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' '));
};

// Set up global error handlers
if (typeof ErrorUtils !== 'undefined') {
  const originalHandler = ErrorUtils.getGlobalHandler();
  
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Log to Sentry
    Sentry.captureException(error, {
      level: isFatal ? 'fatal' : 'error',
      tags: {
        type: 'global_error',
        isFatal: isFatal ? 'yes' : 'no',
      },
    });
    originalHandler && originalHandler(error, isFatal);
  });
}

const handleUnhandledRejection = (event: any) => {
  const error = event.reason || event;
  console.error('Unhandled Promise Rejection:', error);
  Sentry.captureException(error, {
    level: 'error',
    tags: {
      type: 'unhandled_promise_rejection',
    },
  });
};

const originalPromiseReject = Promise.reject;
Promise.reject = function(...args) {
  const result = originalPromiseReject.apply(this, args);
  result.catch((error) => {});
  return result;
};
configureNotificationHandler()

const navTheme = {
  ...NavDefaultTheme,
  colors: {
    ...NavDefaultTheme.colors,
    background: "#FFFFFF",
  },
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; eventId: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, eventId: null }
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true, eventId: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo)
    Sentry.withScope((scope) => {
      scope.setExtras(errorInfo as any);
      const eventId = Sentry.captureException(error);
      this.setState({ eventId });
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center', 
          backgroundColor: '#ffffff',
          padding: 20 
        }}>
          <Text style={{ fontSize: 18, textAlign: 'center', marginBottom: 20 }}>
            Something went wrong. Please restart the app.
          </Text>
          {this.state.eventId && (
            <Text style={{ fontSize: 12, color: '#666', marginTop: 10 }}>
              Error ID: {this.state.eventId}
            </Text>
          )}
        </View>
      )
    }

    return this.props.children
  }
}

function AppContent() {
  const [appIsReady, setAppIsReady] = useState(false)

  useEffect(() => {
    async function prepare() {
      try {
        console.log('App: Starting initialization...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        console.log('App: Initialization complete')
      } catch (e) {
        console.warn('App: Initialization error:', e)
      } finally {
        console.log('App: Setting app as ready')
        setAppIsReady(true)
      }
    }

    prepare()
  }, [])

  useEffect(() => {
    if (appIsReady) {
      console.log('App: Hiding splash screen')
      SplashScreen.hideAsync()
    }
  }, [appIsReady])

  if (!appIsReady) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#ffffff' 
      }}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={{ marginTop: 20, fontSize: 16 }}>Loading...</Text>
      </View>
    )
  }

  return (
    <AppProvider>
      <LocationProvider>
        <PathDeviationProvider>
          <PaperProvider theme={paperTheme}>
            <ToastListener />
            <NavigationContainer theme={navTheme}>
              <StatusBar style="auto" />
              <RootNavigator />
            </NavigationContainer>
          </PaperProvider>
        </PathDeviationProvider>
      </LocationProvider>
    </AppProvider>
  )
}

export default Sentry.wrap(function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
});