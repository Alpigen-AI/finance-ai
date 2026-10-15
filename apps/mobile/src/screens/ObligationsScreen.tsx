import React, { useCallback, useEffect, useState } from "react";
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
    Platform,
    Modal,
    Alert,
    KeyboardAvoidingView,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import api from "../api/client";
import { colors } from "../theme/color";
import { LogoMark } from "../components/Logo";
import { Ionicons } from "@expo/vector-icons";

interface Obligation {
    id: string;
    label: string;
    amount: number;
    due_date: number;
    paid: boolean;
}

interface Profile {
    country: "US" | "IN";
    currency: "USD" | "INR";
}

const getCurrentMonth = () => {
    const d = new Date();

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");

    return `${year}-${month}`;
};

const formatMoney = (
    amount: number,
    country: "US" | "IN",
    currency: string
) => {
    return new Intl.NumberFormat(
        country === "IN" ? "en-IN" : "en-US",
        {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
        }
    ).format(amount);
};

const formatMonth = (month: string) => {
    const [year, monthNumber] = month.split("-").map(Number);

    const date = new Date(year, monthNumber - 1, 1);

    return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    });
};



export default function ObligationsScreen() {
    const navigation = useNavigation<any>();

    const month = getCurrentMonth();

    const [profile, setProfile] = useState<Profile | null>(null);

    const [obligations, setObligations] = useState<Obligation[]>([]);

    const [loading, setLoading] = useState(true);

    const [modalVisible, setModalVisible] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);

    const [label, setLabel] = useState("");

    const [amount, setAmount] = useState("");

    const [dueDate, setDueDate] = useState("");

    const [paid, setPaid] = useState(false);

    const [saving, setSaving] = useState(false);

    const loadObligations = async () => {
        try {
            setLoading(true);

            const [profileRes, obligationsRes] = await Promise.all([
                api.get("/users/me"),
                api.get(`/users/me/obligations/${month}`),
            ]);

            setProfile(profileRes.data);

            setObligations(
                obligationsRes.data.obligations || []
            );
        } catch (error) {
            console.log(
                "Failed to load obligations:",
                error
            );
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadObligations();
        }, [month])
    );

    const openCreateModal = () => {
        setEditingId(null);
        setLabel("");
        setAmount("");
        setDueDate("");
        setPaid(false);

        setModalVisible(true);
    };

    const openEditModal = (obligation: Obligation) => {
        setEditingId(obligation.id);
        setLabel(obligation.label);
        setAmount(String(obligation.amount));
        setDueDate(String(obligation.due_date));
        setPaid(obligation.paid);

        setModalVisible(true);
    };

    const closeModal = () => {
        if (saving) return;

        setModalVisible(false);
    };

    const saveObligation = async () => {
        const cleanLabel = label.trim();

        if (!cleanLabel) {
            Alert.alert(
                "Missing name",
                "Please enter an obligation name."
            );
            return;
        }

        if (!amount || isNaN(Number(amount))) {
            Alert.alert(
                "Invalid amount",
                "Please enter a valid amount."
            );
            return;
        }

        const parsedDueDate = Number(dueDate);

        if (
            !dueDate ||
            isNaN(parsedDueDate) ||
            parsedDueDate < 1 ||
            parsedDueDate > 31
        ) {
            Alert.alert(
                "Invalid due date",
                "Enter a day between 1 and 31."
            );
            return;
        }

        const payload = {
            label: cleanLabel,
            amount: parseFloat(amount),
            due_date: parsedDueDate,
            paid,
        };

        try {
            setSaving(true);

            if (editingId) {
                await api.patch(
                    `/users/me/obligations/${month}/${editingId}`,
                    payload
                );
            } else {
                await api.post(
                    `/users/me/obligations/${month}`,
                    payload
                );
            }

            setModalVisible(false);

            await loadObligations();
        } catch (error) {
            console.log(
                "Failed to save obligation:",
                error
            );

            Alert.alert(
                "Something went wrong",
                "We couldn't save this obligation."
            );
        } finally {
            setSaving(false);
        }
    };

    const deleteObligation = (obligation: Obligation) => {
        Alert.alert(
            "Delete obligation?",
            `Remove "${obligation.label}" from ${formatMonth(month)}?`,
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
                            await api.delete(
                                `/users/me/obligations/${month}/${obligation.id}`
                            );

                            await loadObligations();
                        } catch (error) {
                            console.log(
                                "Failed to delete obligation:",
                                error
                            );

                            Alert.alert(
                                "Something went wrong",
                                "The obligation could not be deleted."
                            );
                        }
                    },
                },
            ]
        );
    };

    const togglePaid = async (obligation: Obligation) => {
        try {
            await api.patch(
                `/users/me/obligations/${month}/${obligation.id}`,
                {
                    label: obligation.label,
                    amount: obligation.amount,
                    due_date: obligation.due_date,
                    paid: !obligation.paid,
                }
            );

            await loadObligations();
        } catch (error) {
            console.log(
                "Failed to update payment status:",
                error
            );
        }
    };

    const totalObligations = obligations.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
    );

    const paidCount = obligations.filter(
        (item) => item.paid
    ).length;

    const unpaidCount =
        obligations.length - paidCount;

    const currency = profile?.currency || "INR";
    const country = profile?.country || "IN";

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar
                barStyle="dark-content"
                backgroundColor={colors.background}
                translucent={false}
            />

            {/* Navbar */}
            <View style={styles.navbar}>
                <View style={styles.navLeft}>
                    <LogoMark size={28} />

                    <Text style={styles.navTitle}>
                        Alpigen{" "}
                        <Text style={{ color: colors.teal }}>
                            AI
                        </Text>
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() =>
                        navigation.navigate("Settings")
                    }
                >
                    <Text style={styles.iconText}>
                        ⚙️
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={
                    styles.scrollContent
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.pageTitle}>
                            Obligations
                        </Text>

                        <Text style={styles.pageSubtitle}>
                            Keep your monthly commitments
                            organized.
                        </Text>
                    </View>

                    <View style={styles.calendarIcon}>
                        <Text style={{ fontSize: 23 }}>


                            <View style={styles.calendarIcon}>
                                <Ionicons name="calendar-outline" size={24} color="#059669" />
                            </View>
                        </Text>
                    </View>
                </View>



                {/* Summary Card */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryTop}>
                        <View>
                            <Text style={styles.summaryLabel}>
                                MONTHLY COMMITMENTS
                            </Text>

                            <Text style={styles.summaryAmount}>
                                {formatMoney(
                                    totalObligations,
                                    country,
                                    currency
                                )}
                            </Text>
                        </View>

                        <View style={styles.summaryIcon}>
                            <Text style={{ fontSize: 21 }}>
                                <View style={styles.summaryIcon}>
                                    <Ionicons name="card-outline" size={22} color="#FFFFFF" />
                                </View>
                            </Text>
                        </View>
                    </View>

                    <View style={styles.summaryDivider} />

                    <View style={styles.summaryStats}>
                        <View>
                            <Text style={styles.statLabel}>
                                Total
                            </Text>

                            <Text style={styles.statValue}>
                                {obligations.length}
                            </Text>
                        </View>

                        <View style={styles.statDivider} />

                        <View>
                            <Text style={styles.statLabel}>
                                Paid
                            </Text>

                            <Text
                                style={[
                                    styles.statValue,
                                    {
                                        color: "#86EFAC",
                                    },
                                ]}
                            >
                                {paidCount}
                            </Text>
                        </View>

                        <View style={styles.statDivider} />

                        <View>
                            <Text style={styles.statLabel}>
                                Remaining
                            </Text>

                            <Text
                                style={[
                                    styles.statValue,
                                    {
                                        color: "#FDE68A",
                                    },
                                ]}
                            >
                                {unpaidCount}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Section Header */}
                <View style={styles.listHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>
                            This month's obligations
                        </Text>

                        <Text style={styles.sectionSubtitle}>
                            {obligations.length === 0
                                ? "Nothing added yet"
                                : `${obligations.length} ${obligations.length === 1
                                    ? "payment"
                                    : "payments"
                                } scheduled`}
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={openCreateModal}
                    >
                        <Text style={styles.addText}>
                            + Add
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Loading */}
                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator
                            size="large"
                            color={colors.teal}
                        />

                        <Text style={styles.loadingText}>
                            Loading obligations...
                        </Text>
                    </View>
                ) : obligations.length === 0 ? (
                    /* Empty State */
                    <View style={styles.emptyCard}>
                        <View style={styles.emptyIcon}>
                            <Text style={{ fontSize: 30 }}>
                                🧾
                            </Text>
                        </View>

                        <Text style={styles.emptyTitle}>
                            No obligations yet
                        </Text>

                        <Text style={styles.emptySubtitle}>
                            Add your rent, subscriptions,
                            bills or other recurring
                            payments for this month.
                        </Text>

                        <TouchableOpacity
                            style={styles.emptyButton}
                            onPress={openCreateModal}
                        >
                            <Text
                                style={
                                    styles.emptyButtonText
                                }
                            >
                                Add First Obligation
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    /* Obligation List */
                    <View>
                        {obligations.map((obligation) => (
                            <View
                                key={obligation.id}
                                style={[
                                    styles.obligationCard,
                                    obligation.paid &&
                                    styles.paidCard,
                                ]}
                            >
                                <View
                                    style={
                                        styles.obligationIcon
                                    }
                                >
                                    <Text
                                        style={{
                                            fontSize: 21,
                                        }}
                                    >
                                        {obligation.paid
                                            ? "✓"
                                            : "₹"}
                                    </Text>
                                </View>

                                <View
                                    style={
                                        styles.obligationInfo
                                    }
                                >
                                    <Text
                                        style={
                                            styles.obligationLabel
                                        }
                                        numberOfLines={1}
                                    >
                                        {obligation.label}
                                    </Text>

                                    <Text
                                        style={
                                            styles.dueText
                                        }
                                    >
                                        Due on{" "}
                                        <Text
                                            style={
                                                styles.dueStrong
                                            }
                                        >
                                            {obligation.due_date}
                                            {obligation.due_date ===
                                                1
                                                ? "st"
                                                : obligation.due_date ===
                                                    2
                                                    ? "nd"
                                                    : obligation.due_date ===
                                                        3
                                                        ? "rd"
                                                        : "th"}
                                        </Text>
                                    </Text>

                                    <View
                                        style={
                                            styles.statusRow
                                        }
                                    >
                                        <View
                                            style={[
                                                styles.statusDot,
                                                {
                                                    backgroundColor:
                                                        obligation.paid
                                                            ? "#22C55E"
                                                            : "#F59E0B",
                                                },
                                            ]}
                                        />

                                        <Text
                                            style={[
                                                styles.statusText,
                                                {
                                                    color: obligation.paid
                                                        ? "#16A34A"
                                                        : "#D97706",
                                                },
                                            ]}
                                        >
                                            {obligation.paid
                                                ? "Paid"
                                                : "Not paid"}
                                        </Text>
                                    </View>
                                </View>

                                <View
                                    style={
                                        styles.obligationRight
                                    }
                                >
                                    <Text
                                        style={
                                            styles.obligationAmount
                                        }
                                    >
                                        {formatMoney(
                                            obligation.amount,
                                            country,
                                            currency
                                        )}
                                    </Text>

                                    <View
                                        style={
                                            styles.actionButtons
                                        }
                                    >
                                        <TouchableOpacity
                                            style={
                                                styles.smallButton
                                            }
                                            onPress={() =>
                                                togglePaid(
                                                    obligation
                                                )
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.smallButtonText
                                                }
                                            >
                                                {obligation.paid
                                                    ? "Undo"
                                                    : "Paid"}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={
                                                styles.moreButton
                                            }
                                            onPress={() =>
                                                Alert.alert(
                                                    obligation.label,
                                                    "What would you like to do?",
                                                    [
                                                        {
                                                            text: "Edit",
                                                            onPress: () =>
                                                                openEditModal(
                                                                    obligation
                                                                ),
                                                        },
                                                        {
                                                            text: "Delete",
                                                            style: "destructive",
                                                            onPress: () =>
                                                                deleteObligation(
                                                                    obligation
                                                                ),
                                                        },
                                                        {
                                                            text: "Cancel",
                                                            style: "cancel",
                                                        },
                                                    ]
                                                )
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.moreText
                                                }
                                            >
                                                ⋮
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Fixed Add Button */}
            <TouchableOpacity
                style={styles.floatingButton}
                onPress={openCreateModal}
                activeOpacity={0.85}
            >
                <Text style={styles.floatingPlus}>
                    +
                </Text>

                <Text style={styles.floatingText}>
                    Add obligation
                </Text>
            </TouchableOpacity>

            {/* Add / Edit Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={closeModal}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={
                        Platform.OS === "ios"
                            ? "padding"
                            : undefined
                    }
                >
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        activeOpacity={1}
                        onPress={closeModal}
                    />

                    <View style={styles.modalContainer}>
                        <View style={styles.modalHandle} />

                        <View
                            style={
                                styles.modalHeader
                            }
                        >
                            <View>
                                <Text
                                    style={
                                        styles.modalTitle
                                    }
                                >
                                    {editingId
                                        ? "Edit obligation"
                                        : "New obligation"}
                                </Text>

                                <Text
                                    style={
                                        styles.modalSubtitle
                                    }
                                >
                                    {formatMonth(month)}
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={
                                    styles.closeButton
                                }
                                onPress={closeModal}
                            >
                                <Text
                                    style={
                                        styles.closeText
                                    }
                                >
                                    <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                                        <Ionicons name="close" size={20} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <Text
                            style={styles.inputLabel}
                        >
                            NAME
                        </Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Rent, Netflix, Internet"
                            placeholderTextColor={
                                colors.textSecondary
                            }
                            value={label}
                            onChangeText={setLabel}
                        />

                        <View
                            style={
                                styles.inputRow
                            }
                        >
                            <View
                                style={
                                    styles.halfInput
                                }
                            >
                                <Text
                                    style={
                                        styles.inputLabel
                                    }
                                >
                                    AMOUNT
                                </Text>

                                <TextInput
                                    style={
                                        styles.modalInput
                                    }
                                    placeholder="15,000"
                                    placeholderTextColor={
                                        colors.textSecondary
                                    }
                                    keyboardType="numeric"
                                    value={amount}
                                    onChangeText={
                                        setAmount
                                    }
                                />
                            </View>

                            <View
                                style={
                                    styles.halfInput
                                }
                            >
                                <Text
                                    style={
                                        styles.inputLabel
                                    }
                                >
                                    DUE DAY
                                </Text>

                                <TextInput
                                    style={
                                        styles.modalInput
                                    }
                                    placeholder="5"
                                    placeholderTextColor={
                                        colors.textSecondary
                                    }
                                    keyboardType="numeric"
                                    value={dueDate}
                                    onChangeText={
                                        setDueDate
                                    }
                                    maxLength={2}
                                />
                            </View>
                        </View>

                        {/* Paid Toggle */}
                        <TouchableOpacity
                            style={
                                styles.paidToggle
                            }
                            onPress={() =>
                                setPaid(!paid)
                            }
                        >
                            <View>
                                <Text
                                    style={
                                        styles.paidToggleTitle
                                    }
                                >
                                    Already paid?
                                </Text>

                                <Text
                                    style={
                                        styles.paidToggleSubtitle
                                    }
                                >
                                    Mark this obligation as
                                    paid for this month.
                                </Text>
                            </View>

                            <View
                                style={[
                                    styles.toggle,
                                    paid &&
                                    styles.toggleActive,
                                ]}
                            >
                                <View
                                    style={[
                                        styles.toggleKnob,
                                        paid &&
                                        styles.toggleKnobActive,
                                    ]}
                                />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={
                                styles.saveObligationButton
                            }
                            onPress={
                                saveObligation
                            }
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator
                                    color="#fff"
                                />
                            ) : (
                                <Text
                                    style={
                                        styles.saveObligationText
                                    }
                                >
                                    {editingId
                                        ? "Save Changes"
                                        : "Create Obligation"}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },

    navbar: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop:
            Platform.OS === "android"
                ? (StatusBar.currentHeight || 24) + 12
                : 12,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
    },

    navLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    navTitle: {
        fontSize: 20,
        fontWeight: "800",
        color: colors.navy,
    },

    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.surface,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },

    iconText: {
        fontSize: 18,
    },

    scrollContent: {
        padding: 20,
        paddingBottom: 150,
    },

    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },

    pageTitle: {
        fontSize: 27,
        fontWeight: "800",
        color: colors.textPrimary,
    },

    pageSubtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 4,
    },

    calendarIcon: {
        width: 50,
        height: 50,
        borderRadius: 17,
        backgroundColor: "#ECFDF5",
        justifyContent: "center",
        alignItems: "center",
    },

    monthSelector: {
        height: 70,
        backgroundColor: colors.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 10,
        marginBottom: 16,
    },

    monthArrow: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
    },

    monthArrowText: {
        fontSize: 30,
        color: colors.navy,
        marginTop: -3,
    },

    monthCenter: {
        alignItems: "center",
    },

    monthSmall: {
        fontSize: 9,
        fontWeight: "800",
        color: colors.teal,
        letterSpacing: 1,
        marginBottom: 2,
    },

    monthTitle: {
        fontSize: 17,
        fontWeight: "800",
        color: colors.textPrimary,
    },

    summaryCard: {
        backgroundColor: colors.navy,
        borderRadius: 22,
        padding: 20,
        marginBottom: 26,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },

    summaryTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },

    summaryLabel: {
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 1,
        color: colors.teal,
    },

    summaryAmount: {
        fontSize: 30,
        fontWeight: "800",
        color: "#fff",
        marginTop: 7,
    },

    summaryIcon: {
        width: 45,
        height: 45,
        borderRadius: 15,
        backgroundColor:
            "rgba(255,255,255,0.10)",
        justifyContent: "center",
        alignItems: "center",
    },

    summaryDivider: {
        height: 1,
        backgroundColor:
            "rgba(255,255,255,0.12)",
        marginVertical: 17,
    },

    summaryStats: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
    },

    statLabel: {
        fontSize: 11,
        color: "rgba(255,255,255,0.55)",
        marginBottom: 3,
    },

    statValue: {
        fontSize: 15,
        fontWeight: "800",
        color: "#fff",
    },

    statDivider: {
        width: 1,
        height: 28,
        backgroundColor:
            "rgba(255,255,255,0.12)",
    },

    listHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },

    sectionTitle: {
        fontSize: 17,
        fontWeight: "800",
        color: colors.textPrimary,
    },

    sectionSubtitle: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 3,
    },

    addText: {
        fontSize: 13,
        fontWeight: "800",
        color: colors.teal,
    },

    obligationCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: 15,
        marginBottom: 11,
        borderWidth: 1,
        borderColor: colors.border,
    },

    paidCard: {
        opacity: 0.72,
    },

    obligationIcon: {
        width: 45,
        height: 45,
        borderRadius: 15,
        backgroundColor: "#EEF2FF",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },

    obligationInfo: {
        flex: 1,
        minWidth: 0,
    },

    obligationLabel: {
        fontSize: 15,
        fontWeight: "800",
        color: colors.textPrimary,
        marginBottom: 4,
    },

    dueText: {
        fontSize: 11,
        color: colors.textSecondary,
    },

    dueStrong: {
        fontWeight: "700",
        color: colors.textPrimary,
    },

    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 6,
    },

    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 5,
    },

    statusText: {
        fontSize: 10,
        fontWeight: "700",
    },

    obligationRight: {
        alignItems: "flex-end",
        marginLeft: 8,
    },

    obligationAmount: {
        fontSize: 15,
        fontWeight: "800",
        color: colors.navy,
        marginBottom: 7,
    },

    actionButtons: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },

    smallButton: {
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: "#ECFDF5",
    },

    smallButtonText: {
        fontSize: 9,
        fontWeight: "800",
        color: "#15803D",
    },

    moreButton: {
        width: 27,
        height: 27,
        borderRadius: 8,
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
    },

    moreText: {
        fontSize: 19,
        color: colors.textSecondary,
        marginTop: -5,
    },

    emptyCard: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 28,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },

    emptyIcon: {
        width: 65,
        height: 65,
        borderRadius: 22,
        backgroundColor: "#EEF2FF",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 14,
    },

    emptyTitle: {
        fontSize: 17,
        fontWeight: "800",
        color: colors.textPrimary,
    },

    emptySubtitle: {
        fontSize: 12,
        lineHeight: 18,
        color: colors.textSecondary,
        textAlign: "center",
        marginTop: 6,
        maxWidth: 280,
    },

    emptyButton: {
        backgroundColor: colors.navy,
        borderRadius: 12,
        paddingHorizontal: 18,
        paddingVertical: 12,
        marginTop: 18,
    },

    emptyButtonText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "800",
    },

    loadingBox: {
        alignItems: "center",
        paddingVertical: 50,
    },

    loadingText: {
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: 10,
    },

    floatingButton: {
        position: "absolute",
        right: 20,
        bottom:
            Platform.OS === "ios" ? 105 : 95,
        height: 52,
        paddingHorizontal: 18,
        borderRadius: 27,
        backgroundColor: colors.navy,
        flexDirection: "row",
        alignItems: "center",
        elevation: 7,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.18,
        shadowRadius: 7,
    },

    floatingPlus: {
        color: "#fff",
        fontSize: 25,
        fontWeight: "400",
        marginRight: 7,
        marginTop: -2,
    },

    floatingText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "800",
    },

    modalOverlay: {
        flex: 1,
        justifyContent: "flex-end",
    },

    modalBackdrop: {
        ...StyleSheet.absoluteFill,
        backgroundColor:
            "rgba(15,23,42,0.45)",
    },

    modalContainer: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 22,
        paddingTop: 10,
        paddingBottom:
            Platform.OS === "ios" ? 35 : 25,
    },

    modalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        alignSelf: "center",
        marginBottom: 18,
    },

    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 22,
    },

    modalTitle: {
        fontSize: 22,
        fontWeight: "800",
        color: colors.textPrimary,
    },

    modalSubtitle: {
        fontSize: 12,
        color: colors.teal,
        fontWeight: "700",
        marginTop: 3,
    },

    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
    },

    closeText: {
        fontSize: 25,
        color: colors.textSecondary,
        marginTop: -3,
    },

    inputLabel: {
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.8,
        color: colors.textSecondary,
        marginBottom: 7,
    },

    modalInput: {
        height: 50,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 13,
        paddingHorizontal: 14,
        fontSize: 15,
        fontWeight: "600",
        color: colors.textPrimary,
        backgroundColor: colors.background,
        marginBottom: 16,
    },

    inputRow: {
        flexDirection: "row",
        gap: 12,
    },

    halfInput: {
        flex: 1,
    },

    paidToggle: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 15,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        marginTop: 2,
        marginBottom: 18,
    },

    paidToggleTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: colors.textPrimary,
    },

    paidToggleSubtitle: {
        fontSize: 10,
        color: colors.textSecondary,
        marginTop: 3,
        maxWidth: 230,
    },

    toggle: {
        width: 45,
        height: 25,
        borderRadius: 13,
        backgroundColor: colors.border,
        padding: 3,
        justifyContent: "center",
    },

    toggleActive: {
        backgroundColor: colors.teal,
    },

    toggleKnob: {
        width: 19,
        height: 19,
        borderRadius: 10,
        backgroundColor: "#fff",
    },

    toggleKnobActive: {
        alignSelf: "flex-end",
    },

    saveObligationButton: {
        height: 52,
        borderRadius: 14,
        backgroundColor: colors.navy,
        justifyContent: "center",
        alignItems: "center",
    },

    saveObligationText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "800",
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

    tabItem: {
        alignItems: "center",
    },

    tabIcon: {
        fontSize: 20,
    },

    tabLabel: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 2,
        fontWeight: "500",
    },
});