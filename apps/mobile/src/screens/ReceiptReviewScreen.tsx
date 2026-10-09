import React, { useState } from "react";
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert,
} from "react-native";
import api from "../api/client";
import { colors } from "../theme/color";

interface LineItem {
    description: string;
    amount: number;
    tax_code: string;
    tax_label: string;
    is_deductible: boolean;
}

export default function ReceiptReviewScreen({ route, navigation }: any) {
    const { receiptId, extracted } = route.params;
    const [vendor, setVendor] = useState(extracted.vendor ?? "");
    const [purchaseDate, setPurchaseDate] = useState(extracted.purchase_date ?? "");
    const [lineItems, setLineItems] = useState<LineItem[]>(
        extracted.line_items.map((i: any) => ({ ...i }))
    );
    const [confirming, setConfirming] = useState(false);

    const updateItem = (index: number, field: keyof LineItem, value: any) => {
        setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    };

    const removeItem = (index: number) => {
        setLineItems((prev) => prev.filter((_, i) => i !== index));
    };

    const confirm = async () => {
        setConfirming(true);
        try {
            await api.post(`/receipts/${receiptId}/confirm`, {
                vendor,
                purchase_date: purchaseDate,
                line_items: lineItems.map((i) => ({
                    description: i.description,
                    amount: i.amount,
                    tax_code: i.tax_code,
                    is_deductible: i.is_deductible,
                })),
            });
            Alert.alert("Saved", `${lineItems.length} expense(s) added.`, [
                { text: "Done", onPress: () => navigation.navigate("Home") },
            ]);
        } catch {
            Alert.alert("Couldn't save", "Check your connection and try again.");
        } finally {
            setConfirming(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.notice}>
                Review before saving — AI can misread receipts, and this becomes part of your tax records.
            </Text>

            <Text style={styles.label}>Vendor</Text>
            <TextInput style={styles.input} value={vendor} onChangeText={setVendor} />

            <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={purchaseDate} onChangeText={setPurchaseDate} />

            <Text style={styles.label}>Line items</Text>
            <FlatList
                data={lineItems}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item, index }) => (
                    <View style={styles.itemCard}>
                        <TextInput
                            style={styles.itemDesc}
                            value={item.description}
                            onChangeText={(v) => updateItem(index, "description", v)}
                        />
                        <View style={styles.itemRow}>
                            <TextInput
                                style={styles.itemAmount}
                                keyboardType="decimal-pad"
                                value={String(item.amount)}
                                onChangeText={(v) => updateItem(index, "amount", parseFloat(v) || 0)}
                            />
                            <Text style={styles.itemCategory}>{item.tax_label}</Text>
                        </View>
                        <View style={styles.itemFooter}>
                            <TouchableOpacity onPress={() => updateItem(index, "is_deductible", !item.is_deductible)}>
                                <Text style={[styles.deductibleToggle, item.is_deductible && styles.deductibleOn]}>
                                    {item.is_deductible ? "✓ Deductible" : "Not deductible"}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => removeItem(index)}>
                                <Text style={styles.remove}>Remove</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={<Text style={styles.hint}>No line items — this receipt might have failed extraction.</Text>}
            />

            <TouchableOpacity style={styles.confirmButton} onPress={confirm} disabled={confirming || lineItems.length === 0}>
                {confirming ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Save {lineItems.length} expense(s)</Text>}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 20 },
    notice: { fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 },
    label: { fontSize: 13, fontWeight: "600", color: colors.textPrimary, marginBottom: 4, marginTop: 8 },
    input: {
        borderWidth: 1, borderColor: colors.border, borderRadius: 10,
        padding: 12, fontSize: 15, backgroundColor: colors.surface, marginBottom: 8,
    },
    itemCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 10 },
    itemDesc: { fontSize: 15, fontWeight: "600", color: colors.textPrimary, marginBottom: 6 },
    itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    itemAmount: { fontSize: 15, color: colors.navy, fontWeight: "600" },
    itemCategory: { fontSize: 12, color: colors.textSecondary },
    itemFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
    deductibleToggle: { fontSize: 12, color: colors.textSecondary },
    deductibleOn: { color: colors.success, fontWeight: "600" },
    remove: { fontSize: 12, color: colors.danger },
    hint: { color: colors.textSecondary, textAlign: "center", marginTop: 20 },
    confirmButton: { backgroundColor: colors.navy, borderRadius: 10, padding: 16, alignItems: "center", marginTop: 12, marginBottom: 20 },
    confirmText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});