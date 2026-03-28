import React, { useRef, useState, useEffect } from "react";
import {
  SafeAreaView,
  StyleSheet,
  View,
  Platform,
  BackHandler,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";

/** Canlı site — Google/Facebook/Instagram OAuth bu adreste tamamlanır */
const SITE_URL = "https://www.tedarikci.org.tr";

/**
 * Varsayılan WebView UA’sında "wv" olduğu için Google girişi engellenebiliyor.
 * Mobil Chrome / Safari ile uyumlu UA kullanıyoruz (OAuth ve çerezler için).
 */
const MOBILE_USER_AGENT =
  Platform.OS === "android"
    ? "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    : "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";

export default function App() {
  const webRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.webviewContainer}>
        <WebView
          ref={webRef}
          source={{ uri: SITE_URL }}
          userAgent={MOBILE_USER_AGENT}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled={Platform.OS === "android"}
          setSupportMultipleWindows
          javaScriptCanOpenWindowsAutomatically
          mixedContentMode="compatibility"
          allowsBackForwardNavigationGestures
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#6366f1" />
            </View>
          )}
          onNavigationStateChange={(nav) => {
            setCanGoBack(nav.canGoBack === true);
          }}
          onShouldStartLoadWithRequest={() => true}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  webviewContainer: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});
