import React, { useEffect, useState } from "react";
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator,
} from "react-native";
import api from "../api/client";
import { colors } from "../theme/color";

interface Obligation { id: string; label: string; amount: number; dueDayOfMonth: number; }

export default function BalanceSetupScreen({ navigation }: any) {
    const [balance, setBalance] = useState("");
    const [savingsTarget, setSavingsTarget] = useState("");
    const [obligations, setObligations] = useState<Obligation[]>([]);
    const [newLabel, setNewLabel] = useState("");
    const [newAmount, setNewAmount] = useState("");
    const [newDueDay, setNewDueDay] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        const [profile, obs] = await Promise.all([
            api.get("/users/me"),
            api.get("/users/me/obligations"),
        ]);
        setBalance(String(profile.data.manualBalance ?? 0));
        setSavingsTarget(String(profile.data.targetSavingsReserve ?? 0));
        setObligations(obs.data.obligations.filter((o: any) => o.isActive));
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const saveBalance = async () => {
        setSaving(true);
        try {
            await api.patch("/users/me", {
                manual_balance: parseFloat(balance) || 0,
                target_savings_reserve: parseFloat(savingsTarget) || 0,
            });
            Alert.alert("Saved", "Your safe-to-spend number will update now.", [
                { text: "OK", onPress: () => navigation.goBack() },
            ]);
        } catch {
            Alert.alert("Error", "Couldn't save — try again.");
        } finally {
            setSaving(false);
        }
    };

    const addObligation = async () => {
        if (!newLabel || !newAmount || !newDueDay) return;
        const res = await api.post("/users/me/obligations", {
            label: newLabel,
            amount: parseFloat(newAmount),
            due_day_of_month: parseInt(newDueDay, 10),
        });
        setObligations((prev) => [...prev, { id: res.data.id, label: newLabel, amount: parseFloat(newAmount), dueDayOfMonth: parseInt(newDueDay, 10) }]);
        setNewLabel(""); setNewAmount(""); setNewDueDay("");
    };

    const removeObligation = async (id: string) => {
        await api.delete(`/users/me/obligations/${id}`);
        setObligations((prev) => prev.filter((o) => o.id !== id));
    };

    if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.navy} />;

    return (
        <FlatList
            style={styles.container}
            ListHeaderComponent={
                <>
                    <Text style={styles.sectionTitle}>Current balance</Text>
                    <Text style={styles.hint}>
                        Manual for now — this becomes automatic once bank linking is set up.
                    </Text>
                    <TextInput
                        style={styles.input}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                        value={balance}
                        onChangeText={setBalance}
                    />

                    <Text style={styles.sectionTitle}>Savings target this month</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                        value={savingsTarget}
                        onChangeText={setSavingsTarget}
                    />

                    <Text style={styles.sectionTitle}>Upcoming bills</Text>
                </>
            }
            data={obligations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
                <View style={styles.obligationRow}>
                    <View>
                        <Text style={styles.obligationLabel}>{item.label}</Text>
                        <Text style={styles.obligationMeta}>Due day {item.dueDayOfMonth} · {item.amount}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeObligation(item.id)}>
                        <Text style={styles.remove}>Remove</Text>
                    </TouchableOpacity>
                </View>
            )}
            ListFooterComponent={
                <>
                    <View style={styles.addRow}>
                        <TextInput style={[styles.input, styles.flexInput]} placeholder="Rent" value={newLabel} onChangeText={setNewLabel} />
                        <TextInput style={[styles.input, styles.smallInput]} placeholder="Amt" keyboardType="decimal-pad" value={newAmount} onChangeText={setNewAmount} />
                        <TextInput style={[styles.input, styles.smallInput]} placeholder="Day" keyboardType="number-pad" value={newDueDay} onChangeText={setNewDueDay} />
                    </View>
                    <TouchableOpacity style={styles.addButton} onPress={addObligation}>
                        <Text style={styles.addButtonText}>+ Add bill</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.saveButton} onPress={saveBalance} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
                    </TouchableOpacity>
                </>
            }
        />
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 20 },
    sectionTitle: { fontSize: 16, fontWeight: "600", color: colors.textPrimary, marginTop: 20, marginBottom: 6 },
    hint: { fontSize: 12, color: colors.textSecondary, marginBottom: 10 },
    input: {
        borderWidth: 1, borderColor: colors.border, borderRadius: 10,
        padding: 12, fontSize: 16, backgroundColor: colors.surface, marginBottom: 8,
    },
    obligationRow: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    obligationLabel: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
    obligationMeta: { fontSize: 12, color: colors.textSecondary },
    remove: { color: colors.danger, fontSize: 13 },
    addRow: { flexDirection: "row", gap: 8, marginTop: 16 },
    flexInput: { flex: 2 },
    smallInput: { flex: 1 },
    addButton: { alignItems: "center", paddingVertical: 8 },
    addButtonText: { color: colors.teal, fontWeight: "600" },
    saveButton: { backgroundColor: colors.navy, borderRadius: 10, padding: 16, alignItems: "center", marginTop: 20, marginBottom: 40 },
    saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});