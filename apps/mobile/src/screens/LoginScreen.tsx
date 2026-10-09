import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from "react-native";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../config/firebase";
import { colors } from "../theme/color";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async () => {
        setError("");
        setLoading(true);
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
                // NOTE: after sign-up, call POST /users/onboard on your API to
                // create the Firestore users/{uid} doc with country + currency
                // before any receipt/chat screen is usable.
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (e: any) {
            setError(e.message.replace("Fireabse: ", "Not an exsiting user , first sign up"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Official Alpigen AI Logo Image */}
            <Image
                source={require("../../assets/logo.png")}
                style={styles.logoImage}
                resizeMode="contain"
            />
            <Text style={styles.subtitle}>{isSignUp ? "Create your account" : "Welcome back"}</Text>

            <TextInput
                style={styles.input}
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
            />
            <TextInput
                style={styles.input}
                placeholder="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : (
                    <Text style={styles.buttonText}>{isSignUp ? "Sign Up" : "Log In"}</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
                <Text style={styles.switchText}>
                    {isSignUp ? "Already have an account? Log in" : "New here? Create an account"}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.background },
    logo: { fontSize: 32, fontWeight: "700", color: colors.navy, textAlign: "center", marginBottom: 8 },
    logoImage: { width: 120, height: 120, alignSelf: "center", marginBottom: 16 },
    subtitle: { fontSize: 16, color: colors.textSecondary, textAlign: "center", marginBottom: 32 },
    input: {
        borderWidth: 1, borderColor: colors.border, borderRadius: 10,
        padding: 14, marginBottom: 12, fontSize: 16, backgroundColor: colors.surface,
    },
    button: { backgroundColor: colors.navy, borderRadius: 10, padding: 16, alignItems: "center", marginTop: 8 },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    switchText: { color: colors.teal, textAlign: "center", marginTop: 16, fontSize: 14 },
    error: { color: colors.danger, textAlign: "center", marginBottom: 8 },
});