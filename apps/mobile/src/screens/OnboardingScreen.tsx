import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from "react-native";
import api from "../api/client";
import { colors } from "../theme/color";

interface Props {
    onComplete: () => void;
    suggestedCountry?: "US" | "IN";
}

export default function OnboardingScreen({ onComplete, suggestedCountry }: Props) {
    const [country, setCountry] = useState<"US" | "IN" | null>(suggestedCountry ?? null);
    const [displayName, setDisplayName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const currencyFor = (c: "US" | "IN") => (c === "US" ? "USD" : "INR");

    const handleContinue = async () => {
        if (!country) return;
        setSubmitting(true);
        setError("");
        try {
            await api.post("/users/onboard", {
                country,
                currency: currencyFor(country),
                display_name: displayName || null,
            });
            onComplete();
        } catch (e: any) {
            console.error("Onboard API Call Failed!");
            console.error("Status:", e?.response?.status);
            console.error("Response Data:", e?.response?.data);
            console.error("Message:", e?.message);
            setError(`Setup failed: ${e?.response?.data?.detail || e.message}`);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome to alpigen <Text style={{ color: colors.teal }}>AI</Text></Text>
            <Text style={styles.subtitle}>
                This decides which tax rules apply to your expenses — IRS Schedule C for
                the US, or Sections 30–37 of the Income Tax Act for India.
            </Text>

            <TextInput
                style={styles.input}
                placeholder="Your name (optional)"
                value={displayName}
                onChangeText={setDisplayName}
            />

            <Text style={styles.label}>I'm filing taxes in</Text>
            <View style={styles.row}>
                <TouchableOpacity
                    style={[styles.countryCard, country === "US" && styles.countryCardSelected]}
                    onPress={() => setCountry("US")}
                >
                    <Text style={styles.flag}>🇺🇸</Text>
                    <Text style={styles.countryLabel}>United States</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.countryCard, country === "IN" && styles.countryCardSelected]}
                    onPress={() => setCountry("IN")}
                >
                    <Text style={styles.flag}>🇮🇳</Text>
                    <Text style={styles.countryLabel}>India</Text>
                </TouchableOpacity>
            </View>

            {suggestedCountry && (
                <Text style={styles.hint}>
                    Guessed from your phone number — change it above if that's not right.
                </Text>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
                style={[styles.button, !country && styles.buttonDisabled]}
                onPress={handleContinue}
                disabled={!country || submitting}
            >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24, paddingTop: 60, backgroundColor: colors.background },
    title: { fontSize: 26, fontWeight: "700", color: colors.navy, marginBottom: 8 },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 28, lineHeight: 20 },
    input: {
        borderWidth: 1, borderColor: colors.border, borderRadius: 10,
        padding: 14, marginBottom: 24, fontSize: 16, backgroundColor: colors.surface,
    },
    label: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginBottom: 12 },
    row: { flexDirection: "row", gap: 12 },
    countryCard: {
        flex: 1, borderWidth: 2, borderColor: colors.border, borderRadius: 14,
        padding: 20, alignItems: "center", backgroundColor: colors.surface,
    },
    countryCardSelected: { borderColor: colors.teal, backgroundColor: "#EAFBFC" },
    flag: { fontSize: 32, marginBottom: 8 },
    countryLabel: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
    hint: { fontSize: 12, color: colors.textSecondary, marginTop: 10 },
    error: { color: colors.danger, textAlign: "center", marginTop: 16 },
    button: { backgroundColor: colors.navy, borderRadius: 10, padding: 16, alignItems: "center", marginTop: 32 },
    buttonDisabled: { backgroundColor: colors.border },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});