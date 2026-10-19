
import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import api from "../api/client";
import { colors } from "../theme/color";

interface Message {
    role: "user" | "agent";
    content: string;
}

const SUGGESTED_MESSAGES = [
    {
        id: "finances",
        title: "Help me with my finances",
        subtitle: "Get guidance for managing your money",
        icon: "↗",
    },
    {
        id: "spending",
        title: "Analyse this month's spending",
        subtitle: "Understand where your money goes",
        icon: "▤",
    },
    {
        id: "safe-spend",
        title: "How much can I safely spend?",
        subtitle: "Check your remaining monthly budget",
        icon: "₹",
    },
    {
        id: "obligations",
        title: "What are my upcoming obligations?",
        subtitle: "Review your pending bills and payments",
        icon: "◷",
    },
];

export default function ChatScreen() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const insets = useSafeAreaInsets();

    const listRef = useRef<FlatList<Message>>(null);

    useEffect(() => {
        let active = true;

        api.get("/chat/history")
            .then((res: { data: { messages: Message[] } }) => {
                if (active) {
                    setMessages(res.data.messages ?? []);
                }
            })
            .catch((error) => {
                console.error("Failed to load chat history:", error);
            })
            .finally(() => {
                if (active) {
                    setLoadingHistory(false);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    const send = async (suggestion?: string) => {
        const text = (suggestion ?? input).trim();

        if (!text || sending) return;

        setInput("");

        setMessages((prev) => [
            ...prev,
            { role: "user", content: text },
        ]);

        setSending(true);

        try {
            const res = await api.post(
                `/chat?message=${encodeURIComponent(text)}`
            );

            setMessages((prev) => [
                ...prev,
                {
                    role: "agent",
                    content: res.data.reply ?? "I couldn't generate a response.",
                },
            ]);
        } catch (error) {
            console.error("Failed to send chat message:", error);

            setMessages((prev) => [
                ...prev,
                {
                    role: "agent",
                    content: "Sorry, I couldn't respond. Please try again.",
                },
            ]);
        } finally {
            setSending(false);

            setTimeout(() => {
                listRef.current?.scrollToEnd({ animated: true });
            }, 150);
        }
    };

    const renderSuggestions = () => (
        <View style={styles.welcomeContainer}>
            <View style={styles.welcomeIcon}>
                <Text style={styles.welcomeIconText}>A</Text>
            </View>

            <Text style={styles.welcomeTitle}>
                Your money,{"\n"}made clearer.
            </Text>

            <Text style={styles.welcomeSubtitle}>
                I'm your financial coach. What would you like help with today?
            </Text>

            <View style={styles.suggestionsHeader}>
                <Text style={styles.suggestionsHeading}>
                    QUICK START
                </Text>
                <Text style={styles.suggestionsCount}>4 suggestions</Text>
            </View>

            <View style={styles.suggestionsList}>
                {SUGGESTED_MESSAGES.map((item, index) => (
                    <TouchableOpacity
                        key={item.id}
                        style={styles.suggestionCard}
                        onPress={() => setInput(item.title)}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.title}. ${item.subtitle}`}
                    >
                        <View
                            style={[
                                styles.suggestionIcon,
                                index === 0 && styles.iconTeal,
                                index === 1 && styles.iconBlue,
                                index === 2 && styles.iconPurple,
                                index === 3 && styles.iconAmber,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.suggestionIconText,
                                    index === 0 && styles.iconTealText,
                                    index === 1 && styles.iconBlueText,
                                    index === 2 && styles.iconPurpleText,
                                    index === 3 && styles.iconAmberText,
                                ]}
                            >
                                {item.icon}
                            </Text>
                        </View>

                        <View style={styles.suggestionCopy}>
                            <Text style={styles.suggestionTitle}>
                                {item.title}
                            </Text>
                            <Text style={styles.suggestionSubtitle}>
                                {item.subtitle}
                            </Text>
                        </View>

                        <Text style={styles.suggestionArrow}>›</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    return (
        <SafeAreaView
            style={styles.safeArea}
            edges={["top", "left", "right"]}
        >
            <KeyboardAvoidingView
                style={styles.container}
                behavior="padding"
                keyboardVerticalOffset={0}
            >
                <View style={styles.header}>
                    <View style={styles.headerLogo}>
                        <Text style={styles.headerLogoText}>A</Text>
                    </View>

                    <View style={styles.headerCopy}>
                        <Text style={styles.headerTitle}>AI Coach</Text>
                        <View style={styles.statusRow}>
                            <View style={styles.statusDot} />
                            <Text style={styles.headerSubtitle}>
                                Your personal finance assistant
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.chatArea}>
                    {loadingHistory ? (
                        <View style={styles.historyLoading}>
                            <ActivityIndicator
                                color={colors.teal}
                                size="small"
                            />
                            <Text style={styles.historyLoadingText}>
                                Loading conversation...
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            ref={listRef}
                            style={styles.messageList}
                            data={messages}
                            keyExtractor={(_, index) => String(index)}
                            contentContainerStyle={[
                                styles.messageContent,
                                messages.length === 0 &&
                                styles.emptyMessageContent,
                            ]}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            ListEmptyComponent={renderSuggestions}
                            renderItem={({ item }) => (
                                <View
                                    style={[
                                        styles.messageRow,
                                        item.role === "user"
                                            ? styles.userMessageRow
                                            : styles.agentMessageRow,
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.bubble,
                                            item.role === "user"
                                                ? styles.userBubble
                                                : styles.agentBubble,
                                        ]}
                                    >
                                        <Text
                                            style={
                                                item.role === "user"
                                                    ? styles.userText
                                                    : styles.agentText
                                            }
                                        >
                                            {item.content}
                                        </Text>
                                    </View>
                                </View>
                            )}
                            onContentSizeChange={() => {
                                if (messages.length > 0) {
                                    listRef.current?.scrollToEnd({
                                        animated: true,
                                    });
                                }
                            }}
                        />
                    )}
                </View>

                {sending && (
                    <View style={styles.loadingRow}>
                        <ActivityIndicator
                            color={colors.teal}
                            size="small"
                        />
                        <Text style={styles.loadingText}>
                            Your coach is thinking...
                        </Text>
                    </View>
                )}

                <View
                    style={[
                        styles.composerContainer,
                        { paddingBottom: Math.max(insets.bottom, 8) + 28 },
                    ]}>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            placeholder="Ask about your finances..."
                            placeholderTextColor="#8A94A6"
                            value={input}
                            onChangeText={setInput}
                            onSubmitEditing={() => send()}
                            returnKeyType="send"
                            blurOnSubmit={false}
                            multiline
                            maxLength={2000}
                            editable={!sending}
                            accessibilityLabel="Message your AI finance coach"
                        />

                        <TouchableOpacity
                            style={[
                                styles.sendButton,
                                (!input.trim() || sending) &&
                                styles.sendButtonDisabled,
                            ]}
                            onPress={() => send()}
                            disabled={!input.trim() || sending}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="Send message"
                        >
                            <Text style={styles.sendText}>↑</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.composerHint}>
                        Your financial data is accessed when needed to answer
                        your request.
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },
    container: {
        flex: 1,
        minHeight: 0,
    },

    // Header
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 18,
        paddingVertical: 13,
        backgroundColor: colors.background,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        gap: 12,
    },
    headerLogo: {
        width: 43,
        height: 43,
        borderRadius: 15,
        backgroundColor: colors.navy,
        alignItems: "center",
        justifyContent: "center",
    },
    headerLogoText: {
        fontSize: 21,
        fontWeight: "800",
        color: "#FFFFFF",
    },
    headerCopy: {
        flex: 1,
        gap: 3,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: colors.textPrimary,
    },
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: colors.teal,
    },
    headerSubtitle: {
        fontSize: 12,
        color: colors.textPrimary,
        opacity: 0.65,
    },

    // Chat area
    chatArea: {
        flex: 1,
        minHeight: 0,
    },
    messageList: {
        flex: 1,
    },
    messageContent: {
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 16,
        flexGrow: 1,
    },
    emptyMessageContent: {
        justifyContent: "center",
        flexGrow: 1,
    },
    historyLoading: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },
    historyLoadingText: {
        fontSize: 13,
        color: colors.textPrimary,
        opacity: 0.65,
    },

    // Welcome and suggestions
    welcomeContainer: {
        width: "100%",
        paddingVertical: 8,
    },
    welcomeIcon: {
        width: 48,
        height: 48,
        borderRadius: 17,
        backgroundColor: colors.navy,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 18,
    },
    welcomeIconText: {
        color: "#FFFFFF",
        fontSize: 25,
        fontWeight: "800",
    },
    welcomeTitle: {
        fontSize: 29,
        lineHeight: 36,
        letterSpacing: -0.7,
        fontWeight: "800",
        color: colors.textPrimary,
        marginBottom: 9,
    },
    welcomeSubtitle: {
        fontSize: 14,
        lineHeight: 21,
        color: colors.textPrimary,
        opacity: 0.7,
        marginBottom: 25,
        maxWidth: 310,
    },
    suggestionsHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 11,
    },
    suggestionsHeading: {
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1.3,
        color: colors.textPrimary,
        opacity: 0.65,
    },
    suggestionsCount: {
        fontSize: 11,
        color: colors.textPrimary,
        opacity: 0.5,
    },
    suggestionsList: {
        gap: 10,
    },
    suggestionCard: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 13,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        gap: 11,
    },
    suggestionIcon: {
        width: 39,
        height: 39,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
    },
    suggestionIconText: {
        fontSize: 21,
        fontWeight: "700",
    },
    iconTeal: {
        backgroundColor: "#DDF4EE",
    },
    iconTealText: {
        color: "#197D68",
    },
    iconBlue: {
        backgroundColor: "#E3EDFC",
    },
    iconBlueText: {
        color: "#3869B1",
    },
    iconPurple: {
        backgroundColor: "#EEE7FC",
    },
    iconPurpleText: {
        color: "#7951B5",
    },
    iconAmber: {
        backgroundColor: "#FFF0D9",
    },
    iconAmberText: {
        color: "#A96B17",
    },
    suggestionCopy: {
        flex: 1,
        gap: 4,
    },
    suggestionTitle: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: "700",
        color: colors.textPrimary,
    },
    suggestionSubtitle: {
        fontSize: 11,
        lineHeight: 16,
        color: colors.textPrimary,
        opacity: 0.65,
    },
    suggestionArrow: {
        fontSize: 25,
        lineHeight: 28,
        color: colors.textPrimary,
        opacity: 0.45,
        paddingLeft: 2,
    },

    // Message bubbles
    messageRow: {
        width: "100%",
        marginBottom: 12,
    },
    userMessageRow: {
        alignItems: "flex-end",
    },
    agentMessageRow: {
        alignItems: "flex-start",
    },
    bubble: {
        maxWidth: "86%",
        borderRadius: 18,
        paddingHorizontal: 15,
        paddingVertical: 12,
    },
    userBubble: {
        backgroundColor: colors.navy,
        borderBottomRightRadius: 5,
        marginLeft: 30,
    },
    agentBubble: {
        backgroundColor: colors.surface,
        borderBottomLeftRadius: 5,
        marginRight: 30,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    userText: {
        color: "#FFFFFF",
        fontSize: 15,
        lineHeight: 22,
    },
    agentText: {
        color: colors.textPrimary,
        fontSize: 15,
        lineHeight: 22,
    },

    // Loading indicator
    loadingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 9,
        gap: 8,
    },
    loadingText: {
        fontSize: 12,
        color: colors.textPrimary,
        opacity: 0.7,
    },

    // Composer
    composerContainer: {
        paddingHorizontal: 14,
        paddingTop: 11,
        paddingBottom: 22,
        backgroundColor: colors.background,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 25,
        padding: 5,
        minHeight: 54,
    },
    input: {
        flex: 1,
        maxHeight: 110,
        minHeight: 42,
        paddingHorizontal: 13,
        paddingTop: 11,
        paddingBottom: 10,
        color: colors.textPrimary,
        fontSize: 14,
        lineHeight: 21,
    },
    sendButton: {
        width: 43,
        height: 43,
        borderRadius: 22,
        backgroundColor: colors.teal,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 5,
        marginBottom: 0,
    },
    sendButtonDisabled: {
        opacity: 0.45,
    },
    sendText: {
        color: "#FFFFFF",
        fontSize: 25,
        lineHeight: 29,
        fontWeight: "700",
    },
    composerHint: {
        textAlign: "center",
        fontSize: 10,
        lineHeight: 15,
        color: colors.textPrimary,
        opacity: 0.5,
        marginTop: 7,
        paddingHorizontal: 4,
    },
});
