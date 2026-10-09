import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TextInput,
    SafeAreaView,
    StatusBar,
    Linking,
    Platform,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import api from "../api/client";
import { colors } from "../theme/color";
import { LogoMark } from "../components/Logo";

interface Profile {
    country: "US" | "IN";
    currency: "USD" | "INR";
    tier: string;
    displayName?: string;
}

interface Savings {
    totalAllocated: number;
    totalSpent: number;
    totalObligations: number;
    remaining: number;
    reserve?: number;
}

const getCurrentMonth = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
};

function formatMoney(amount: number, country: "US" | "IN", currency: string) {
    return new Intl.NumberFormat(country === "IN" ? "en-IN" : "en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(amount);
}

export default function HomeScreen() {
    const navigation = useNavigation<any>();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [savings, setSavings] = useState<Savings | null>(null);
    const [budgetInput, setBudgetInput] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        try {
            console.log("========== HOME LOAD ==========");

            const currentMonth = new Date().toISOString().slice(0, 7);

            const [profileRes, savingsRes] = await Promise.all([
                api.get("/users/me"),
                api.get(`/users/savings/${currentMonth}`),
            ]);

            console.log("PROFILE RESPONSE:", profileRes.data);
            console.log("SAVINGS RESPONSE:", savingsRes.data);

            setProfile(profileRes.data);
            setSavings(savingsRes.data);

        } catch (error) {
            console.error("HOME LOAD ERROR:", error);
        } finally {
            // THIS IS CRITICAL
            setLoading(false);
        }
    };
    useFocusEffect(
        React.useCallback(() => {
            load();
        }, [])
    );

    const saveBudget = async () => {
        if (!budgetInput || isNaN(Number(budgetInput))) return;
        setSaving(true);
        const currentMonth = getCurrentMonth();
        try {
            await api.post("/users/savings", {
                total_allocated: parseFloat(budgetInput),
                month: currentMonth,
            });
            await load();
            setBudgetInput("");
            setIsEditing(false);
        } catch (err) {
            console.log("Failed to save budget:", err);
        } finally {
            setSaving(false);
        }
    };

    const openWebDashboard = () => {
        // Direct link to open web dashboard in web browser
        Linking.openURL("https://sadyaatra-web-page.vercel.app");
    };

    if (loading || !profile) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.navy} />
            </View>
        );
    }

    const hasBudget = savings !== null && savings.totalAllocated > 0 && !isEditing;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} translucent={false} />

            {/* Top Navigation Bar with Notch Clearance */}
            <View style={styles.navbar}>
                <View style={styles.navLeft}>
                    <LogoMark size={28} />
                    <Text style={styles.navTitle}>
                        Alpigen <Text style={{ color: colors.teal }}>AI</Text>
                    </Text>
                </View>
                <View style={styles.navRight}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate("Settings")}>
                        <Text style={styles.iconText}>⚙️</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Main Content Area */}
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Greeting Header */}
                <View style={styles.headerContainer}>
                    <Text style={styles.greetingTitle}>
                        Hello, {profile.displayName || "User"} 👋
                    </Text>
                    <Text style={styles.greetingSub}>Here is your financial overview for this month.</Text>
                </View>

                {/* Main Financial Overview Card */}
                {!hasBudget ? (
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>MONTHLY SPENDING LIMIT</Text>
                        <Text style={styles.cardHint}>
                            Set how much you're comfortable spending this month. We'll track what's safe to spend live.
                        </Text>
                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.input}
                                placeholder={profile.country === "IN" ? "30,000" : "3,000"}
                                placeholderTextColor={colors.textSecondary}
                                keyboardType="numeric"
                                value={budgetInput}
                                onChangeText={setBudgetInput}
                            />
                            <TouchableOpacity style={styles.saveBtn} onPress={saveBudget} disabled={saving}>
                                {saving ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Set Budget</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={styles.remainingCard}>
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.remainingLabel}>
                                SAFE TO SPEND THIS MONTH
                            </Text>

                            <TouchableOpacity
                                onPress={() => {
                                    setBudgetInput(String(savings!.totalAllocated));
                                    setIsEditing(true);
                                }}
                            >
                                <Text style={styles.editLink}>Edit Budget</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.remainingAmount}>
                            {formatMoney(
                                savings!.remaining,
                                profile.country,
                                profile.currency
                            )}
                        </Text>

                        <View style={styles.remainingFooter}>

                            {/* SPENT */}
                            <View style={styles.statCol}>
                                <Text style={styles.statLabel}>Spent</Text>
                                <Text style={styles.statValue}>
                                    {formatMoney(
                                        savings!.totalSpent,
                                        profile.country,
                                        profile.currency
                                    )}
                                </Text>
                            </View>

                            <View style={styles.divider} />

                            {/* COMMITTED */}
                            <View style={styles.statCol}>
                                <Text style={styles.statLabel}>Committed</Text>
                                <Text style={styles.statValue}>
                                    {formatMoney(
                                        savings!.totalObligations,
                                        profile.country,
                                        profile.currency
                                    )}
                                </Text>
                            </View>

                            <View style={styles.divider} />

                            {/* BUDGET */}
                            <View style={styles.statCol}>
                                <Text style={styles.statLabel}>Budget</Text>
                                <Text style={styles.statValue}>
                                    {formatMoney(
                                        savings!.totalAllocated,
                                        profile.country,
                                        profile.currency
                                    )}
                                </Text>
                            </View>

                        </View>
                    </View>
                )}

                {/* Feature Grid / Quick Action Cards */}
                <Text style={styles.sectionHeader}>Quick Actions</Text>
                <View style={styles.gridContainer}>
                    <TouchableOpacity style={styles.gridCard} onPress={() => navigation.navigate("Camera")}>
                        <View style={[styles.iconCircle, { backgroundColor: "#EEF2FF" }]}>
                            <Text style={styles.cardEmoji}>📷</Text>
                        </View>
                        <Text style={styles.cardTitle}>Scan Receipt</Text>
                        <Text style={styles.cardSubtitle}>Auto-extract expenses</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.gridCard} onPress={() => navigation.navigate("Chat")}>
                        <View style={[styles.iconCircle, { backgroundColor: "#F0FDF4" }]}>
                            <Text style={styles.cardEmoji}>💬</Text>
                        </View>
                        <Text style={styles.cardTitle}>Ask AI Coach</Text>
                        <Text style={styles.cardSubtitle}>Can I afford this?</Text>
                    </TouchableOpacity>
                </View>

                {/* Monthly Obligations */}
                <TouchableOpacity
                    style={styles.obligationHomeCard}
                    onPress={() => navigation.navigate("Obligations")}
                    activeOpacity={0.85}
                >
                    <View style={styles.obligationHomeIcon}>
                        <Text style={{ fontSize: 23 }}>📅</Text>
                    </View>

                    <View style={styles.obligationHomeContent}>
                        <Text style={styles.obligationHomeTitle}>
                            Monthly Obligations
                        </Text>

                        <Text style={styles.obligationHomeSubtitle}>
                            Manage rent, bills, subscriptions and other fixed payments
                        </Text>
                    </View>

                    <View style={styles.obligationArrowCircle}>
                        <Text style={styles.obligationArrow}>›</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.expenseHomeCard}
                    onPress={() =>
                        navigation.navigate("ExpenseHistory")
                    }
                    activeOpacity={0.85}
                >
                    <View style={styles.expenseHomeIcon}>
                        <Text style={{ fontSize: 23 }}>💳</Text>
                    </View>

                    <View style={styles.expenseHomeContent}>
                        <Text style={styles.expenseHomeTitle}>
                            Monthly Expenses
                        </Text>

                        <Text style={styles.expenseHomeSubtitle}>
                            Manage your variable spending and daily expenses
                        </Text>
                    </View>

                    <View style={styles.expenseArrowCircle}>
                        <Text style={styles.expenseArrow}>›</Text>
                    </View>
                </TouchableOpacity>

                {/* Secondary Actions */}
                <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate("ExpenseHistory")}>
                    <Text style={styles.actionEmoji}>📋</Text>
                    <View style={styles.actionText}>
                        <Text style={styles.actionTitle}>Recent Receipts & History</Text>
                        <Text style={styles.actionSubtitle}>Review uploaded scans and items</Text>
                    </View>
                    <Text style={styles.arrowIcon}>›</Text>
                </TouchableOpacity>

                {/* Web Dashboard CTA Banner */}
                <View style={styles.webBanner}>
                    <View style={styles.webBannerContent}>
                        <Text style={styles.webBannerTitle}>Full Yearly Analytics</Text>
                        <Text style={styles.webBannerSub}>
                            View detailed charts, spending trends, and annual reports on our Web App.
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.webBannerBtn} onPress={openWebDashboard}>
                        <Text style={styles.webBannerBtnText}>Open Web ↗</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Bottom Tab Navigation Bar */}
            <View style={styles.bottomTabBar}>
                <TouchableOpacity style={styles.tabItem} onPress={() => { }}>
                    <Text style={styles.tabIcon}>🏠</Text>
                    <Text style={[styles.tabLabel, styles.tabActive]}>Home</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate("Camera")}>
                    <Text style={styles.tabIcon}>📷</Text>
                    <Text style={styles.tabLabel}>Scan</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate("Chat")}>
                    <Text style={styles.tabIcon}>💬</Text>
                    <Text style={styles.tabLabel}>Coach</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.tabItem} onPress={openWebDashboard}>
                    <Text style={styles.tabIcon}>📊</Text>
                    <Text style={styles.tabLabel}>Analytics</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
    },

    // Navbar - Keeps header below top notch and status bar
    navbar: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 12 : 12,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
    },
    navLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    navRight: { flexDirection: "row", alignItems: "center" },
    navTitle: { fontSize: 20, fontWeight: "800", color: colors.navy },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    iconText: { fontSize: 18 },

    // Scroll Content Padding
    scrollContent: {
        padding: 20,
        paddingBottom: 140, // Keeps bottom cards clear of tab bar
    },

    headerContainer: { marginBottom: 20 },
    greetingTitle: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },
    greetingSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

    // Budget Entry Card
    card: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 24,
    },
    cardLabel: { fontSize: 11, fontWeight: "700", color: colors.teal, letterSpacing: 0.8, marginBottom: 6 },
    cardHint: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 16 },
    inputRow: { flexDirection: "row", gap: 10 },
    input: {
        flex: 1,
        height: 48,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        fontSize: 16,
        fontWeight: "600",
        color: colors.textPrimary,
        backgroundColor: colors.background,
    },
    saveBtn: { backgroundColor: colors.navy, borderRadius: 12, paddingHorizontal: 20, justifyContent: "center" },
    saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

    // Safe-to-Spend Dashboard Card
    remainingCard: {
        backgroundColor: colors.navy,
        borderRadius: 20,
        padding: 22,
        marginBottom: 24,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    remainingLabel: { fontSize: 11, fontWeight: "700", color: colors.teal, letterSpacing: 0.8 },
    remainingAmount: { fontSize: 36, fontWeight: "800", color: "#fff", marginVertical: 12 },
    remainingFooter: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.15)",
        paddingTop: 14,
        marginTop: 6,
    },
    statCol: { alignItems: "center" },
    statLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 2 },
    statValue: { fontSize: 14, fontWeight: "700", color: "#fff" },
    divider: { width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.15)" },
    editLink: { fontSize: 12, fontWeight: "700", color: colors.teal },

    sectionHeader: { fontSize: 17, fontWeight: "700", color: colors.textPrimary, marginBottom: 14 },

    // Quick Action Grid
    gridContainer: { flexDirection: "row", gap: 12, marginBottom: 14 },
    gridCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 12 },
    cardEmoji: { fontSize: 22 },
    cardTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
    cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

    actionRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: colors.border,
    },
    actionEmoji: { fontSize: 22, marginRight: 14 },
    actionText: { flex: 1 },
    actionTitle: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
    actionSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    arrowIcon: { fontSize: 20, color: colors.textSecondary },

    // Web App Banner
    webBanner: {
        backgroundColor: "#EEF2FF",
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: "#C7D2FE",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    webBannerContent: { flex: 1, paddingRight: 10 },
    webBannerTitle: { fontSize: 15, fontWeight: "700", color: colors.navy },
    webBannerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
    webBannerBtn: { backgroundColor: colors.navy, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
    webBannerBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

    // Bottom Navigation Bar - Lifts icons above phone home/back controls
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
        paddingBottom: Platform.OS === "ios" ? 34 : 42,
        elevation: 8,
    },
    tabItem: { alignItems: "center" },
    tabIcon: { fontSize: 20 },
    tabLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontWeight: "500" },
    tabActive: { color: colors.teal, fontWeight: "700" },
    obligationHomeCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: 16,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: colors.border,
    },

    obligationHomeIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: "#ECFDF5",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 14,
    },

    obligationHomeContent: {
        flex: 1,
        paddingRight: 8,
    },

    obligationHomeTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: colors.textPrimary,
    },

    obligationHomeSubtitle: {
        fontSize: 12,
        lineHeight: 17,
        color: colors.textSecondary,
        marginTop: 3,
    },

    obligationArrowCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
    },

    obligationArrow: {
        fontSize: 22,
        color: colors.navy,
        marginTop: -2,
    },
    expenseHomeCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: 16,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: colors.border,
    },

    expenseHomeIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: "#EEF2FF",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 14,
    },

    expenseHomeContent: {
        flex: 1,
        paddingRight: 8,
    },

    expenseHomeTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: colors.textPrimary,
    },

    expenseHomeSubtitle: {
        fontSize: 12,
        lineHeight: 17,
        color: colors.textSecondary,
        marginTop: 3,
    },

    expenseArrowCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
    },

    expenseArrow: {
        fontSize: 22,
        color: colors.navy,
        marginTop: -2,
    },
});