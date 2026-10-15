import React, { useCallback, useState } from "react";
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Platform
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import api from "../api/client";
import { colors } from "../theme/color";
import { Ionicons } from "@expo/vector-icons";

interface Expense {
    id: string;
    vendor: string;
    amount: number;
    currency?: string;
    expenseDate: string;
    taxCode?: string;
    taxLabel?: string;
    isDeductible?: boolean;
    notes?: string | null;
    receiptId?: string | null;
    source?: "manual" | "receipt";
}

const getCurrentMonth = () => {
    const now = new Date();

    return `${now.getFullYear()}-${String(
        now.getMonth() + 1
    ).padStart(2, "0")}`;
};

const formatDisplayDate = (dateString: string) => {
    if (!dateString) return "—";

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const formatAmount = (
    amount: number,
    currency?: string
) => {
    const symbol =
        currency === "USD"
            ? "$"
            : currency === "INR"
                ? "₹"
                : currency ?? "";

    return `${symbol}${Number(amount || 0).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }
    )}`;
};

export default function ExpenseHistoryScreen({
    navigation,
}: any) {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(
        null
    );

    const month = getCurrentMonth();

    const loadExpenses = useCallback(async () => {
        try {
            setLoading(true);

            const res = await api.get(
                `/expenses/${month}`
            );

            setExpenses(res.data.expenses ?? []);
        } catch (error) {
            console.log(
                "Expense history load error:",
                error
            );

            Alert.alert(
                "Couldn't load expenses",
                "Please try again."
            );
        } finally {
            setLoading(false);
        }
    }, [month]);

    useFocusEffect(
        useCallback(() => {
            loadExpenses();
        }, [loadExpenses])
    );

    const handleDelete = (expense: Expense) => {
        Alert.alert(
            "Delete Expense",
            `Delete ${expense.vendor} — ${formatAmount(
                expense.amount,
                expense.currency
            )}?`,
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setDeletingId(expense.id);

                            await api.delete(
                                `/expenses/${month}/${expense.id}`
                            );

                            setExpenses((current) =>
                                current.filter(
                                    (item) =>
                                        item.id !==
                                        expense.id
                                )
                            );
                        } catch (error) {
                            console.log(
                                "Delete expense error:",
                                error
                            );

                            Alert.alert(
                                "Delete failed",
                                "Couldn't delete this expense."
                            );
                        } finally {
                            setDeletingId(null);
                        }
                    },
                },
            ]
        );
    };

    const renderExpense = ({
        item,
    }: {
        item: Expense;
    }) => {
        const isDeleting =
            deletingId === item.id;

        return (
            <TouchableOpacity
                style={styles.expenseCard}
                activeOpacity={0.85}
                onPress={() =>
                    navigation.navigate(
                        "ExpenseEntry",
                        {
                            expense: item,
                        }
                    )
                }
            >
                <View style={styles.expenseMain}>
                    <View style={styles.expenseIcon}>
                        <Text style={styles.expenseIconText}>
                            ₹
                        </Text>
                    </View>

                    <View style={styles.expenseInfo}>
                        <Text
                            style={styles.vendor}
                            numberOfLines={1}
                        >
                            {item.vendor || "Unnamed expense"}
                        </Text>

                        <Text style={styles.date}>
                            {formatDisplayDate(
                                item.expenseDate
                            )}
                        </Text>

                        {item.taxLabel ? (
                            <Text
                                style={styles.category}
                                numberOfLines={1}
                            >
                                {item.taxLabel}
                            </Text>
                        ) : null}
                    </View>

                    <View style={styles.expenseRight}>
                        <Text style={styles.amount}>
                            {formatAmount(
                                item.amount,
                                item.currency
                            )}
                        </Text>

                        <Text style={styles.editHint}>
                            Edit
                        </Text>
                    </View>
                </View>

                <View style={styles.bottomRow}>
                    <View>
                        {item.source === "receipt" ? (
                            <Text style={styles.source}>
                                AI receipt
                            </Text>
                        ) : (
                            <Text style={styles.source}>
                                Manual
                            </Text>
                        )}

                        {item.isDeductible ? (
                            <Text style={styles.deductible}>
                                Tax deductible
                            </Text>
                        ) : null}
                    </View>

                    <TouchableOpacity
                        onPress={() =>
                            handleDelete(item)
                        }
                        disabled={isDeleting}
                        style={styles.deleteButton}
                    >
                        {isDeleting ? (
                            <ActivityIndicator
                                size="small"
                                color={colors.danger}
                            />
                        ) : (
                            <Text
                                style={styles.deleteText}
                            >
                                Delete
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator
                    size="large"
                    color={colors.navy}
                />
            </View>
        );
    }

    const total = expenses.reduce(
        (sum, expense) =>
            sum + Number(expense.amount || 0),
        0
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>
                        Expenses
                    </Text>

                    <Text style={styles.subtitle}>
                        {new Date(
                            `${month}-01T00:00:00`
                        ).toLocaleDateString("en-IN", {
                            month: "long",
                            year: "numeric",
                        })}
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() =>
                        navigation.navigate(
                            "ExpenseEntry"
                        )
                    }
                    activeOpacity={0.85}
                >
                    <Text style={styles.addButtonText}>
                        + Add
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Monthly total */}
            <View style={styles.summaryCard}>
                <View>
                    <Text style={styles.summaryLabel}>
                        MONTHLY EXPENSES
                    </Text>

                    <Text style={styles.summaryAmount}>
                        {formatAmount(total, "INR")}
                    </Text>
                </View>

                <View style={styles.countBadge}>
                    <Text style={styles.countNumber}>
                        {expenses.length}
                    </Text>

                    <Text style={styles.countLabel}>
                        {expenses.length === 1
                            ? "expense"
                            : "expenses"}
                    </Text>
                </View>
            </View>

            <FlatList
                data={expenses}
                keyExtractor={(item) => item.id}
                renderItem={renderExpense}
                contentContainerStyle={
                    expenses.length === 0
                        ? styles.emptyContainer
                        : styles.listContent
                }
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIcon}>
                            <Text
                                style={
                                    styles.emptyIconText
                                }
                            >
                                ₹
                            </Text>
                        </View>

                        <Text style={styles.emptyTitle}>
                            No expenses yet
                        </Text>

                        <Text
                            style={styles.emptyDescription}
                        >
                            Add your first expense manually
                            or scan a receipt with AI.
                        </Text>

                        <TouchableOpacity
                            style={styles.emptyAddButton}
                            onPress={() =>
                                navigation.navigate(
                                    "ExpenseEntry"
                                )
                            }
                        >
                            <Text
                                style={
                                    styles.emptyAddButtonText
                                }
                            >
                                Add Expense
                            </Text>
                        </TouchableOpacity>
                    </View>
                }
            />
            {/* Bottom Navigation */}
            <View style={styles.bottomTabBar}>
                <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate("Home")}>
                    <Ionicons name="home-outline" size={22} color={colors.textSecondary} />
                    <Text style={styles.tabLabel}>Home</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate("Camera")}>
                    <Ionicons name="scan-outline" size={22} color={colors.textSecondary} />
                    <Text style={styles.tabLabel}>Scan</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate("Chat")}>
                    <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.textSecondary} />
                    <Text style={styles.tabLabel}>Coach</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate("Analytics")}>
                    <Ionicons name="stats-chart-outline" size={22} color={colors.textSecondary} />
                    <Text style={styles.tabLabel}>Analytics</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },

    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
    },

    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 14,
    },
    tabItem: {
        alignItems: "center",
        minWidth: 64,
        gap: 3,
    },
    tabLabel: {
        fontSize: 11,
        color: colors.textSecondary,
        fontWeight: "600",
    },
    bottomTabBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 10,
        paddingBottom:
            Platform.OS === "ios" ? 34 : 42,
        elevation: 8,
    },


    title: {
        fontSize: 28,
        fontWeight: "700",
        color: colors.textPrimary,
    },

    subtitle: {
        marginTop: 3,
        fontSize: 13,
        color: colors.textSecondary,
    },

    addButton: {
        backgroundColor: colors.navy,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },

    addButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
    },

    summaryCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 18,
        borderRadius: 16,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    summaryLabel: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.7,
        color: colors.textSecondary,
    },

    summaryAmount: {
        marginTop: 5,
        fontSize: 25,
        fontWeight: "700",
        color: colors.navy,
    },

    countBadge: {
        alignItems: "center",
        justifyContent: "center",
        minWidth: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: colors.background,
    },

    countNumber: {
        fontSize: 19,
        fontWeight: "700",
        color: colors.textPrimary,
    },

    countLabel: {
        fontSize: 10,
        color: colors.textSecondary,
        marginTop: 1,
    },

    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 30,
    },

    expenseCard: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
    },

    expenseMain: {
        flexDirection: "row",
        alignItems: "center",
    },

    expenseIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
        marginRight: 12,
    },

    expenseIconText: {
        fontSize: 17,
        fontWeight: "700",
        color: colors.navy,
    },

    expenseInfo: {
        flex: 1,
        minWidth: 0,
    },

    vendor: {
        fontSize: 15,
        fontWeight: "700",
        color: colors.textPrimary,
    },

    date: {
        marginTop: 3,
        fontSize: 12,
        color: colors.textSecondary,
    },

    category: {
        marginTop: 3,
        fontSize: 11,
        color: colors.textSecondary,
    },

    expenseRight: {
        alignItems: "flex-end",
        marginLeft: 10,
    },

    amount: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.navy,
    },

    editHint: {
        marginTop: 4,
        fontSize: 10,
        color: colors.textSecondary,
    },

    bottomRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },

    source: {
        fontSize: 10,
        color: colors.textSecondary,
    },

    deductible: {
        marginTop: 2,
        fontSize: 10,
        color: colors.success,
        fontWeight: "600",
    },

    deleteButton: {
        paddingHorizontal: 8,
        paddingVertical: 5,
    },

    deleteText: {
        fontSize: 11,
        color: colors.danger,
        fontWeight: "600",
    },

    emptyContainer: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 30,
        paddingBottom: 80,
    },

    emptyState: {
        alignItems: "center",
    },

    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
        marginBottom: 16,
    },

    emptyIconText: {
        fontSize: 24,
        fontWeight: "700",
        color: colors.navy,
    },

    emptyTitle: {
        fontSize: 19,
        fontWeight: "700",
        color: colors.textPrimary,
    },

    emptyDescription: {
        textAlign: "center",
        fontSize: 13,
        lineHeight: 20,
        color: colors.textSecondary,
        marginTop: 7,
        maxWidth: 290,
    },

    emptyAddButton: {
        marginTop: 18,
        backgroundColor: colors.navy,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
    },

    emptyAddButtonText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 14,
    },
});