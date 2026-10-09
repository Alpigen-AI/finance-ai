import React, { useEffect, useRef, useState } from "react";
import {
    View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import api from "../api/client";
import { colors } from "../theme/color";

interface Message { role: "user" | "agent"; content: string; }

export default function ChatScreen() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const listRef = useRef<FlatList>(null);

    useEffect(() => {
        api.get("/chat/history")
            .then((res: { data: { messages: Message[] } }) => setMessages(res.data.messages));
    }, []);

    const send = async () => {
        if (!input.trim() || sending) return;
        const text = input.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: text }]);
        setSending(true);
        try {
            const res = await api.post(`/chat?message=${encodeURIComponent(text)}`);
            setMessages((prev) => [...prev, { role: "agent", content: res.data.reply }]);
        } catch {
            setMessages((prev) => [...prev, { role: "agent", content: "Sorry, I couldn't respond — try again." }]);
        } finally {
            setSending(false);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(_, i) => String(i)}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                    <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.agentBubble]}>
                        <Text style={item.role === "user" ? styles.userText : styles.agentText}>{item.content}</Text>
                    </View>
                )}
            />
            {sending && <ActivityIndicator color={colors.teal} style={{ marginBottom: 8 }} />}
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    placeholder="Ask about your spending..."
                    value={input}
                    onChangeText={setInput}
                    onSubmitEditing={send}
                />
                <TouchableOpacity style={styles.sendButton} onPress={send}>
                    <Text style={styles.sendText}>Send</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    bubble: { maxWidth: "80%", borderRadius: 16, padding: 12, marginBottom: 10 },
    userBubble: { backgroundColor: colors.navy, alignSelf: "flex-end", borderBottomRightRadius: 4 },
    agentBubble: { backgroundColor: colors.surface, alignSelf: "flex-start", borderBottomLeftRadius: 4 },
    userText: { color: "#fff" },
    agentText: { color: colors.textPrimary },
    inputRow: { flexDirection: "row", padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
    input: { flex: 1, backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8 },
    sendButton: { backgroundColor: colors.teal, borderRadius: 20, paddingHorizontal: 18, justifyContent: "center" },
    sendText: { color: "#fff", fontWeight: "600" },
});