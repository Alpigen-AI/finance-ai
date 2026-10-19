import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import api from "../api/client";
import { colors } from "../theme/color";
import { Ionicons } from "@expo/vector-icons";

type MonthlyReport = {
    month: string;
    budgetExists: boolean;
    summary: {
        budget: number;
        reserve: number;
        totalSpent: number;
        totalObligations: number;
        safeToSpend: number;
        overBudget: number;
        expenseCount: number;
        obligationCount: number;
    };
    categoryBreakdown: { category: string; amount: number; percentage: number }[];
};

type AiInsights = {
    available: boolean;
    message?: string;
    summary?: string;
    budgetStatus?: {
        status: "on_track" | "close_to_limit" | "over_budget" | "no_budget";
        message: string;
    };
    mostSpentOn?: { name: string; amount: number; comment: string } | null;
    topCategory?: {
        category: string;
        amount: number;
        percentage: number;
        comment: string;
    } | null;
    mostPurchased?: { name: string; count: number; comment: string } | null;
    leastPurchased?: { name: string; count: number; comment: string } | null;
    watchOut?: { title: string; detail: string }[];
    keyTakeaway?: string;
    nextMonthTips?: string[];
};
type IconName = React.ComponentProps<typeof Ionicons>["name"];


const formatMoney = (value: number) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2,
    })}`;

const toMonthKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const getMonthLabel = (month: string) => {
    const [year, monthNumber] = month.split("-").map(Number);
    return new Date(year, monthNumber - 1, 1).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
    });
};

const shiftMonth = (month: string, offset: number) => {
    const [year, monthNumber] = month.split("-").map(Number);
    return toMonthKey(new Date(year, monthNumber - 1 + offset, 1));
};

const BUDGET_STATUS: Record<
    "on_track" | "close_to_limit" | "over_budget" | "no_budget",
    { icon: IconName; title: string; tint: string }
> = {
    on_track: { icon: "checkmark-circle-outline", title: "On track", tint: "#197D68" },
    close_to_limit: { icon: "alert-circle-outline", title: "Close to your limit", tint: "#A96B17" },
    over_budget: { icon: "warning-outline", title: "Over budget", tint: "#C0392B" },
    no_budget: { icon: "flag-outline", title: "No budget set", tint: "#3869B1" },
};

export default function ReviewReportsScreen() {
    const [selectedMonth, setSelectedMonth] = useState(() => toMonthKey(new Date()));

    const [report, setReport] = useState<MonthlyReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const [ai, setAi] = useState<AiInsights | null>(null);
    const [aiLoading, setAiLoading] = useState(true);
    const [aiError, setAiError] = useState(false);
    const aiRequestId = useRef(0);

    const loadReport = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setError("");

        try {
            const response = await api.get(`/reports/monthly/${selectedMonth}`);
            setReport(response.data);
        } catch (err: any) {
            console.error(
                "Failed to load monthly report:",
                err?.response?.data ?? err?.message ?? err
            );
            setReport(null);
            setError(
                err?.response?.data?.detail ||
                "Couldn't load this report. Please try again."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedMonth]);

    const loadInsights = useCallback(async () => {
        const requestId = ++aiRequestId.current;

        setAiLoading(true);
        setAiError(false);
        setAi(null);

        try {
            const response = await api.get(
                `/reports/monthly/${selectedMonth}/insights`
            );
            if (requestId === aiRequestId.current) setAi(response.data);
        } catch (err: any) {
            console.error(
                "Failed to load insights:",
                err?.response?.data ?? err?.message ?? err
            );
            if (requestId === aiRequestId.current) setAiError(true);
        } finally {
            if (requestId === aiRequestId.current) setAiLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        void loadReport();
        void loadInsights();
    }, [loadReport, loadInsights]);

    const onRefresh = () => {
        void loadReport(true);
        void loadInsights();
    };

    const categories: [string, number][] = (report?.categoryBreakdown ?? []).map(
        (c) => [c.category, c.amount]
    );
    const highestCategory = Math.max(0, ...categories.map(([, amount]) => amount));

    const currentMonthKey = toMonthKey(new Date());

    const previousMonth = () => {
        setSelectedMonth((current) => shiftMonth(current, -1));
    };

    const nextMonth = () => {
        setSelectedMonth((current) => {
            if (current >= currentMonthKey) return current;
            return shiftMonth(current, 1);
        });
    };

    const renderInsightCard = (
        icon: IconName,
        title: string,
        text?: string,
        key?: string | number,
        tint: string = colors.teal
    ) => (
        <View key={key} style={styles.insightCard}>
            <View style={[styles.insightIconWrap, { backgroundColor: `${tint}1A` }]}>
                <Ionicons name={icon} size={20} color={tint} />
            </View>
            <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>{title}</Text>
                {!!text && <Text style={styles.insightText}>{text}</Text>}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.teal}
                    />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.eyebrow}>YOUR FINANCES</Text>
                        <Text style={styles.title}>Reports & Insights</Text>
                        <Text style={styles.subtitle}>
                            Understand where your money goes.
                        </Text>
                    </View>
                    <View style={styles.headerIcon}>
                        <Text style={styles.headerEmoji}><Text style={styles.actionEmoji}><View style={styles.expenseHomeIcon}>
                            <Ionicons name="bar-chart-outline" size={22} color={colors.navy} />
                        </View></Text></Text>
                    </View>
                </View>

                {/* Month selector */}
                <View style={styles.monthSelector}>
                    <TouchableOpacity
                        onPress={previousMonth}
                        style={styles.monthButton}
                        accessibilityLabel="Previous month"
                    >
                        <Text style={styles.monthArrow}>‹</Text>
                    </TouchableOpacity>

                    <View style={styles.monthCenter}>
                        <Text style={styles.monthCaption}>MONTHLY REPORT</Text>
                        <Text style={styles.monthLabel}>
                            {getMonthLabel(selectedMonth)}
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={nextMonth}
                        disabled={selectedMonth >= currentMonthKey}
                        style={[
                            styles.monthButton,
                            selectedMonth >= currentMonthKey && styles.disabledButton,
                        ]}
                        accessibilityLabel="Next month"
                    >
                        <Text style={styles.monthArrow}>›</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.centerState}>
                        <ActivityIndicator size="large" color={colors.teal} />
                        <Text style={styles.stateText}>Preparing your report...</Text>
                    </View>
                ) : error ? (
                    <View style={styles.stateCard}>
                        <Ionicons name="alert-circle-outline" size={32} color="#C0392B" style={{ marginBottom: 12 }} />
                        <Text style={styles.stateTitle}>Report unavailable</Text>
                        <Text style={styles.stateText}>{error}</Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={onRefresh}
                        >
                            <Text style={styles.retryText}>Try again</Text>
                        </TouchableOpacity>
                    </View>
                ) : report ? (
                    <>
                        {/* Hero */}
                        <View style={styles.heroCard}>
                            <View style={styles.heroTopRow}>
                                <Text style={styles.heroLabel}>TOTAL SPENT</Text>
                                <View style={styles.heroBadge}>
                                    <Text style={styles.heroBadgeText}>MONTHLY</Text>
                                </View>
                            </View>

                            <Text style={styles.heroAmount}>
                                {formatMoney(report.summary.totalSpent)}
                            </Text>
                            <Text style={styles.heroDescription}>
                                Across {report.summary.expenseCount} recorded{" "}
                                {report.summary.expenseCount === 1
                                    ? "expense"
                                    : "expenses"}
                            </Text>

                            <View style={styles.heroDivider} />

                            <View style={styles.heroFooter}>
                                <Text style={styles.heroFooterLabel}>
                                    {report.budgetExists
                                        ? "Budget target"
                                        : "Budget target (not set)"}
                                </Text>
                                <Text style={styles.heroFooterAmount}>
                                    {formatMoney(report.summary.budget)}
                                </Text>
                            </View>
                        </View>

                        {/* Quick stats */}
                        <View style={styles.statsRow}>
                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>Obligations</Text>
                                <Text style={styles.statValue}>
                                    {formatMoney(report.summary.totalObligations)}
                                </Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>Safe to spend</Text>
                                <Text style={styles.statValue}>
                                    {formatMoney(report.summary.safeToSpend)}
                                </Text>
                            </View>
                        </View>

                        {/* Category breakdown */}
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Spending breakdown</Text>
                            <Text style={styles.sectionSubtitle}>
                                Your expenses by category
                            </Text>
                        </View>

                        <View style={styles.card}>
                            {categories.length === 0 ? (
                                <View style={styles.emptyCategories}>
                                    <Ionicons name="receipt-outline" size={32} color={colors.teal} style={{ marginBottom: 12 }} />
                                    <Text style={styles.emptyTitle}>
                                        No spending recorded
                                    </Text>
                                    <Text style={styles.emptyDescription}>
                                        Your category breakdown will appear here when
                                        expenses are recorded for this month.
                                    </Text>
                                </View>
                            ) : (
                                categories.map(([category, amount], index) => {
                                    const percentage =
                                        report.summary.totalSpent > 0
                                            ? (amount / report.summary.totalSpent) * 100
                                            : 0;
                                    const barWidth =
                                        highestCategory > 0
                                            ? (amount / highestCategory) * 100
                                            : 0;

                                    return (
                                        <View
                                            key={category}
                                            style={[
                                                styles.categoryItem,
                                                index === categories.length - 1 &&
                                                styles.lastCategoryItem,
                                            ]}
                                        >
                                            <View style={styles.categoryTop}>
                                                <View style={styles.categoryNameWrap}>
                                                    <View style={styles.categoryDot} />
                                                    <Text
                                                        style={styles.categoryName}
                                                        numberOfLines={1}
                                                    >
                                                        {category}
                                                    </Text>
                                                </View>
                                                <Text style={styles.categoryAmount}>
                                                    {formatMoney(amount)}
                                                </Text>
                                            </View>

                                            <View style={styles.progressTrack}>
                                                <View
                                                    style={[
                                                        styles.progressFill,
                                                        { width: `${barWidth}%` },
                                                    ]}
                                                />
                                            </View>

                                            <Text style={styles.categoryPercentage}>
                                                {percentage.toFixed(1)}% of recorded
                                                expenses
                                            </Text>
                                        </View>
                                    );
                                })
                            )}
                        </View>

                        {/* AI insights */}
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>AI insights</Text>
                            <Text style={styles.sectionSubtitle}>
                                Your month, explained
                            </Text>
                        </View>

                        {aiLoading ? (
                            <View style={styles.aiLoading}>
                                <ActivityIndicator color={colors.teal} />
                                <Text style={styles.stateText}>
                                    Analysing your month...
                                </Text>
                            </View>
                        ) : aiError ? (
                            <View style={styles.stateCard}>
                                <Text style={styles.stateText}>
                                    Couldn't generate insights right now.
                                </Text>
                                <TouchableOpacity
                                    style={styles.retryButton}
                                    onPress={() => void loadInsights()}
                                >
                                    <Text style={styles.retryText}>Try again</Text>
                                </TouchableOpacity>
                            </View>
                        ) : ai && !ai.available ? (
                            renderInsightCard("file-tray-outline", "Nothing to analyse", ai.message)
                        ) : ai ? (
                            <View style={styles.insightList}>
                                {renderInsightCard("document-text-outline", "Summary", ai.summary)}

                                {ai.budgetStatus &&
                                    (() => {
                                        const s = BUDGET_STATUS[ai.budgetStatus.status] ?? BUDGET_STATUS.no_budget;
                                        return renderInsightCard(
                                            s.icon,
                                            s.title,
                                            ai.budgetStatus.message,
                                            "budget",
                                            s.tint
                                        );
                                    })()}

                                {ai.mostSpentOn &&
                                    renderInsightCard(
                                        "wallet-outline",
                                        `Most spent on: ${ai.mostSpentOn.name} (${formatMoney(ai.mostSpentOn.amount)})`,
                                        ai.mostSpentOn.comment,
                                        "most-spent",
                                        "#3869B1"
                                    )}

                                {ai.topCategory &&
                                    renderInsightCard(
                                        "pricetag-outline",
                                        `Top category: ${ai.topCategory.category} (${formatMoney(ai.topCategory.amount)})`,
                                        ai.topCategory.comment,
                                        "top-category",
                                        "#7951B5"
                                    )}

                                {ai.mostPurchased &&
                                    renderInsightCard(
                                        "repeat-outline",
                                        `Most purchased: ${ai.mostPurchased.name} (${ai.mostPurchased.count}×)`,
                                        ai.mostPurchased.comment,
                                        "most-purchased"
                                    )}

                                {ai.leastPurchased &&
                                    renderInsightCard(
                                        "trending-down-outline",
                                        `Least purchased: ${ai.leastPurchased.name} (${ai.leastPurchased.count}×)`,
                                        ai.leastPurchased.comment,
                                        "least-purchased",
                                        "#3869B1"
                                    )}

                                {ai.watchOut?.map((w, i) =>
                                    renderInsightCard(
                                        "warning-outline",
                                        `Watch out: ${w.title}`,
                                        w.detail,
                                        `watch-${i}`,
                                        "#A96B17"
                                    )
                                )}

                                {ai.keyTakeaway &&
                                    renderInsightCard(
                                        "bulb-outline",
                                        "Key takeaway to save more",
                                        ai.keyTakeaway,
                                        "takeaway",
                                        "#197D68"
                                    )}

                                {!!ai.nextMonthTips?.length && (
                                    <View style={styles.insightCard}>
                                        <View style={[styles.insightIconWrap, { backgroundColor: `${colors.teal}1A` }]}>
                                            <Ionicons name="trending-up-outline" size={20} color={colors.teal} />
                                        </View>
                                        <View style={styles.insightContent}>
                                            <Text style={styles.insightTitle}>Next month's tips</Text>
                                            {ai.nextMonthTips.map((tip, i) => (
                                                <Text key={i} style={styles.tipText}>• {tip}</Text>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </View>
                        ) : null}

                        <View style={styles.noteCard}>
                            <Ionicons name="information-circle-outline" size={18} color={colors.textPrimary} style={{ opacity: 0.6 }} />
                            <Text style={styles.noteText}>
                                Amounts come from your recorded expenses, obligations
                                and budget. AI insights only explain these numbers and
                                can occasionally be imperfect.
                            </Text>
                        </View>
                    </>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 22,
    },
    eyebrow: {
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 1.8,
        color: colors.teal,
        marginBottom: 7,
    },
    title: {
        fontSize: 25,
        fontWeight: "800",
        color: colors.textPrimary,
        letterSpacing: -0.6,
    },
    subtitle: {
        fontSize: 13,
        color: colors.textSecondary ?? colors.textPrimary,
        opacity: 0.7,
        marginTop: 6,
    },
    headerIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    headerEmoji: { fontSize: 22 },
    monthSelector: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 18,
        padding: 8,
        marginBottom: 20,
    },
    monthButton: {
        width: 42,
        height: 42,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
    },
    disabledButton: { opacity: 0.3 },
    monthArrow: { fontSize: 28, lineHeight: 32, color: colors.textPrimary },
    monthCenter: { flex: 1, alignItems: "center" },
    monthCaption: {
        fontSize: 9,
        fontWeight: "800",
        letterSpacing: 1.3,
        color: colors.teal,
    },
    monthLabel: {
        fontSize: 15,
        fontWeight: "700",
        color: colors.textPrimary,
        marginTop: 4,
    },
    actionEmoji: { fontSize: 22, marginRight: 14 },
    centerState: { paddingVertical: 70, alignItems: "center" },
    aiLoading: { paddingVertical: 30, alignItems: "center" },
    stateCard: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 20,
        padding: 24,
        alignItems: "center",
    },
    stateEmoji: { fontSize: 28, marginBottom: 12 },
    stateTitle: {
        fontSize: 17,
        fontWeight: "800",
        color: colors.textPrimary,
        marginBottom: 8,
    },
    stateText: {
        fontSize: 13,
        lineHeight: 20,
        textAlign: "center",
        color: colors.textPrimary,
        opacity: 0.7,
        marginTop: 10,
    },
    retryButton: {
        marginTop: 18,
        backgroundColor: colors.teal,
        paddingHorizontal: 22,
        paddingVertical: 11,
        borderRadius: 12,
    },
    retryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
    heroCard: {
        backgroundColor: colors.navy,
        borderRadius: 24,
        padding: 22,
        marginBottom: 14,
    },
    heroTopRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    heroLabel: {
        fontSize: 10,
        letterSpacing: 1.5,
        fontWeight: "800",
        color: "#FFFFFF",
        opacity: 0.75,
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
    heroBadge: {
        backgroundColor: "rgba(255,255,255,0.13)",
        borderRadius: 7,
        paddingHorizontal: 9,
        paddingVertical: 5,
    },
    heroBadgeText: {
        color: "#FFFFFF",
        fontSize: 9,
        fontWeight: "800",
        letterSpacing: 0.8,
    },
    heroAmount: {
        color: "#FFFFFF",
        fontSize: 34,
        fontWeight: "800",
        letterSpacing: -0.8,
        marginTop: 16,
    },
    heroDescription: {
        color: "#FFFFFF",
        fontSize: 12,
        opacity: 0.72,
        marginTop: 6,
    },
    heroDivider: {
        height: 1,
        backgroundColor: "rgba(255,255,255,0.18)",
        marginVertical: 20,
    },
    heroFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    heroFooterLabel: { color: "#FFFFFF", fontSize: 12, opacity: 0.8 },
    heroFooterAmount: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
    statsRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
    statCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 15,
    },
    statLabel: { fontSize: 11, color: colors.textPrimary, opacity: 0.65 },
    statValue: {
        fontSize: 20,
        fontWeight: "800",
        color: colors.textPrimary,
        marginTop: 5,
    },
    sectionHeader: { marginBottom: 13, marginTop: 2 },
    sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
    sectionSubtitle: {
        fontSize: 12,
        color: colors.textPrimary,
        opacity: 0.6,
        marginTop: 5,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 16,
        paddingVertical: 4,
        marginBottom: 28,
    },
    categoryItem: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    lastCategoryItem: { borderBottomWidth: 0 },
    categoryTop: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },
    categoryNameWrap: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
    },
    categoryDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.teal,
    },
    categoryName: {
        flex: 1,
        fontSize: 13,
        fontWeight: "600",
        color: colors.textPrimary,
    },
    categoryAmount: { fontSize: 13, fontWeight: "800", color: colors.textPrimary },
    progressTrack: {
        height: 7,
        backgroundColor: colors.background,
        borderRadius: 6,
        overflow: "hidden",
        marginTop: 12,
    },
    progressFill: {
        height: "100%",
        backgroundColor: colors.teal,
        borderRadius: 6,
    },
    categoryPercentage: {
        fontSize: 10,
        color: colors.textPrimary,
        opacity: 0.55,
        marginTop: 7,
    },
    emptyCategories: { paddingVertical: 28, alignItems: "center" },
    emptyEmoji: { fontSize: 30, marginBottom: 12 },
    emptyTitle: { fontSize: 15, fontWeight: "800", color: colors.textPrimary },
    emptyDescription: {
        fontSize: 12,
        lineHeight: 19,
        textAlign: "center",
        color: colors.textPrimary,
        opacity: 0.65,
        marginTop: 8,
        paddingHorizontal: 8,
    },
    insightList: { gap: 10 },
    insightCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 17,
        gap: 13,
    },
    insightIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
    },
    insightEmoji: { fontSize: 20 },
    insightContent: { flex: 1 },
    insightTitle: { fontSize: 14, fontWeight: "800", color: colors.textPrimary },
    insightText: {
        fontSize: 12,
        lineHeight: 19,
        color: colors.textPrimary,
        opacity: 0.72,
        marginTop: 7,
    },
    tipText: {
        fontSize: 12,
        lineHeight: 19,
        color: colors.textPrimary,
        opacity: 0.8,
        marginTop: 6,
    },
    noteCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 9,
        marginTop: 14,
        padding: 14,
        backgroundColor: colors.surface,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: colors.border,
    },
    noteIcon: { fontSize: 15 },
    noteText: {
        flex: 1,
        fontSize: 11,
        lineHeight: 17,
        color: colors.textPrimary,
        opacity: 0.65,
    },
});