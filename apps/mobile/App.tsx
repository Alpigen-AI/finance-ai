import React, { useEffect, useState } from "react";
import {
  View,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import { NavigationContainer } from "@react-navigation/native";
import {
  createNativeStackNavigator,
} from "@react-navigation/native-stack";

import type { RootStackParamList } from "./src/types/navigation";

import {
  onAuthStateChanged,
  User,
} from "firebase/auth";

import { auth } from "./src/config/firebase";
import api from "./src/api/client";

import LoginScreen from "./src/screens/LoginScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import HomeScreen from "./src/screens/HomeScreen";
import CameraCaptureScreen from "./src/screens/CameraCaptureScreen";
import ReceiptReviewScreen from "./src/screens/ReceiptReviewScreen";
import ChatScreen from "./src/screens/ChatScreen";
import ExpenseHistoryScreen from "./src/screens/ExpenseHistoryScreen";
import BalanceSetupScreen from "./src/screens/BalanceSetupScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import ObligationsScreen from "./src/screens/ObligationsScreen";

import { colors } from "./src/theme/color";

const Stack =
  createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  const [initializing, setInitializing] =
    useState(true);

  const [onboarded, setOnboarded] =
    useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        console.log(
          "AUTH STATE:",
          firebaseUser?.email ?? "logged out"
        );

        // Logged out
        if (!firebaseUser) {
          setUser(null);
          setOnboarded(null);
          setInitializing(false);
          return;
        }

        // Logged in
        setUser(firebaseUser);

        try {
          console.log(
            "CHECKING USER PROFILE..."
          );

          const res =
            await api.get("/users/me");

          console.log(
            "PROFILE CHECK:",
            res.data
          );

          const hasCountry =
            !!res.data?.country;

          const hasCurrency =
            !!res.data?.currency;

          if (
            hasCountry &&
            hasCurrency
          ) {
            console.log(
              "USER IS ONBOARDED"
            );

            setOnboarded(true);
          } else {
            console.log(
              "USER IS NOT ONBOARDED"
            );

            setOnboarded(false);
          }
        } catch (error: any) {
          console.log(
            "PROFILE CHECK ERROR:",
            error?.response?.status,
            error?.response?.data,
            error?.message
          );

          setOnboarded(false);
        } finally {
          setInitializing(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  /*
   * ----------------------------------------
   * INITIAL AUTH / PROFILE CHECK
   * ----------------------------------------
   */

  if (initializing) {
    return (
      <View
        style={styles.loadingContainer}
      >
        <ActivityIndicator
          size="large"
          color={colors.navy}
        />
      </View>
    );
  }

  /*
   * ----------------------------------------
   * NAVIGATION
   * ----------------------------------------
   */

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerTintColor:
            colors.navy,

          headerTitleStyle: {
            color: colors.navy,
          },
        }}
      >

        {/* NOT LOGGED IN */}
        {!user ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              headerShown: false,
            }}
          />
        ) : !onboarded ? (

          /* LOGGED IN BUT NOT ONBOARDED */
          <Stack.Screen
            name="Onboarding"
            options={{
              headerShown: false,
            }}
          >
            {() => (
              <OnboardingScreen
                onComplete={() =>
                  setOnboarded(true)
                }
              />
            )}
          </Stack.Screen>

        ) : (

          /* FULL APP */
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{
                headerShown: false,
              }}
            />

            <Stack.Screen
              name="Camera"
              component={
                CameraCaptureScreen
              }
              options={{
                title:
                  "Scan Receipt",
              }}
            />

            <Stack.Screen
              name="ReceiptReview"
              component={
                ReceiptReviewScreen
              }
              options={{
                title:
                  "Review Receipt",
              }}
            />

            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{
                title:
                  "Your Coach",
              }}
            />

            <Stack.Screen
              name="ExpenseHistory"
              component={
                ExpenseHistoryScreen
              }
              options={{
                title:
                  "Monthly Expenses",
              }}
            />

            <Stack.Screen
              name="ExpenseEntry"
              component={
                CameraCaptureScreen
              }
              options={{
                title:
                  "Add Expense",
              }}
            />

            <Stack.Screen
              name="BalanceSetup"
              component={
                BalanceSetupScreen
              }
              options={{
                title:
                  "Balance & Bills",
              }}
            />

            <Stack.Screen
              name="Settings"
              component={
                SettingsScreen
              }
              options={{
                title:
                  "Settings",
              }}
            />

            <Stack.Screen
              name="Obligations"
              component={
                ObligationsScreen
              }
              options={{
                headerShown: false,
              }}
            />
          </>
        )}

      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor:
      colors.background,
  },
});