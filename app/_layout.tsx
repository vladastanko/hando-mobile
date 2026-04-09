import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { auth } from '../src/lib/supabase';
import { initLang } from '../src/i18n';
import { AppProvider, useAppContext } from '../src/context/AppContext';
import { ToastArea } from '../src/components/ui/Toast';
import AuthScreen from '../src/screens/AuthScreen';
import { colors } from '../src/theme';

function RootInner() {
  const { user, setUser, toasts, dismissToast } = useAppContext();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    initLang().catch(() => {});

    auth.getSession().then(({ session }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? undefined });
      }
      setChecking(false);
    });

    const { data: sub } = auth.onAuthChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? undefined });
      } else {
        setUser(null);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (!user) {
    return (
      <>
        <AuthScreen onSuccess={(u) => setUser(u)} />
        <ToastArea toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <>
      <Slot />
      <ToastArea toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <RootInner />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
