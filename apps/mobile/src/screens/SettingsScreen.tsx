import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";
import api from "../api/client";
import { colors } from "../theme/color";

export default function SettingsScreen({ navigation }: any) {
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        api.get("/users/me").then((res) => setProfile(res.data));
    }, []);

    if (!profile) return <ActivityIndicator style={{ flex: 1 }} color={colors.navy} />;

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{profile.email}</Text>

                <Text style={styles.label}>Country</Text>
                <Text style={styles.value}>{profile.country === "US" ? "🇺🇸 United States" : "🇮🇳 India"}</Text>

                <Text style={styles.label}>Plan</Text>
                <Text style={styles.value}>Free</Text>
            </View>

            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("BalanceSetup")}>
                <Text style={styles.rowText}>Balance & bills</Text>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            {profile.tier !== "premium" && (
                <TouchableOpacity style={styles.upgradeButton} onPress={() => Alert.alert("Coming soon", "Billing isn't wired up yet.")}>
                    <Text style={styles.upgradeText}>Upgrade to Premium</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.logoutButton} onPress={() => signOut(auth)}>
                <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 20 },
    card: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 20 },
    label: { fontSize: 12, color: colors.textSecondary, marginTop: 10 },
    value: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
    row: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    rowText: { fontSize: 15, color: colors.textPrimary },
    chevron: { fontSize: 18, color: colors.textSecondary },
    upgradeButton: { backgroundColor: colors.teal, borderRadius: 10, padding: 16, alignItems: "center", marginTop: 24 },
    upgradeText: { color: "#fff", fontWeight: "600" },
    logoutButton: { padding: 16, alignItems: "center", marginTop: 12 },
    logoutText: { color: colors.danger, fontWeight: "600" },
});