import React, { useRef, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    Switch,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import api from "../api/client";
import { colors } from "../theme/color";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";

type Expense = {
    id?: string;
    vendor: string;
    amount: string;
    expense_date: string;
    tax_code: string;
    is_deductible: boolean;
    notes: string;
    receipt_id?: string;
};

function getCurrentMonth() {
    const now = new Date();

    return `${now.getFullYear()}-${String(
        now.getMonth() + 1
    ).padStart(2, "0")}`;
}

export default function CameraCaptureScreen({
    navigation,
    route,
}: any) {
    const cameraRef = useRef<CameraView>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [permission, requestPermission] =
        useCameraPermissions();

    const [showCamera, setShowCamera] =
        useState(false);

    const [processing, setProcessing] =
        useState(false);

    const [saving, setSaving] =
        useState(false);

    const [editingId, setEditingId] =
        useState<string | null>(
            route?.params?.expense?.id ?? null
        );

    const existingExpense =
        route?.params?.expense;

    const [vendor, setVendor] =
        useState(existingExpense?.vendor ?? "");

    const [amount, setAmount] =
        useState(
            existingExpense?.amount
                ? String(existingExpense.amount)
                : ""
        );

    const [expenseDate, setExpenseDate] =
        useState(
            existingExpense?.expenseDate ??
            new Date().toISOString().split("T")[0]
        );

    const [taxCode, setTaxCode] =
        useState(existingExpense?.taxCode ?? "");

    const [isDeductible, setIsDeductible] =
        useState(
            existingExpense?.isDeductible ?? true
        );

    const [notes, setNotes] =
        useState(existingExpense?.notes ?? "");

    const [receiptId, setReceiptId] =
        useState<string | undefined>(
            existingExpense?.receiptId
        );

    const pickReceipt = async () => {
        try {
            setProcessing(true);

            const permission =
                await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permission.granted) {
                Alert.alert(
                    "Permission required",
                    "Please allow photo library access to upload a receipt."
                );
                return;
            }

            const result =
                await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ["images"],
                    quality: 0.7,
                    allowsEditing: false,
                });

            if (result.canceled || !result.assets?.length) {
                return;
            }

            const asset = result.assets[0];

            const formData = new FormData();

            formData.append(
                "file",
                {
                    uri: asset.uri,
                    name: asset.fileName ?? "receipt.jpg",
                    type: asset.mimeType ?? "image/jpeg",
                } as any
            );

            const response = await api.post(
                "/expenses/extract",
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                }
            );

            const extracted = response.data.extracted;

            setVendor(extracted.vendor ?? "");

            setAmount(
                extracted.amount != null
                    ? String(extracted.amount)
                    : ""
            );

            setExpenseDate(
                extracted.expense_date ??
                new Date().toISOString().split("T")[0]
            );

            setTaxCode(
                extracted.line_items?.[0]?.tax_code ??
                extracted.tax_code ??
                ""
            );

            setIsDeductible(
                extracted.is_deductible ?? false
            );

            setNotes(extracted.notes ?? "");
            setIsDeductible(
                extracted.is_deductible ?? false
            );

            setReceiptId(response.data.receipt_id);

            Alert.alert(
                "Receipt scanned",
                "Please review the extracted details before saving."
            );
        } catch (error: any) {
            console.log("Gallery extraction error:", error);

            const message =
                error.response?.status === 402
                    ? "You've hit your free-tier scan limit this month."
                    : "Couldn't read that receipt. Try a clearer image.";

            Alert.alert("Scan failed", message);
        } finally {
            setProcessing(false);
        }
    };

    // --------------------------------------------------
    // TAKE PHOTO
    // --------------------------------------------------

    const takePhoto = async () => {
        if (!cameraRef.current) return;

        try {
            setProcessing(true);

            const photo =
                await cameraRef.current.takePictureAsync({
                    quality: 0.7,
                });

            if (!photo) return;

            const formData = new FormData();

            formData.append(
                "file",
                {
                    uri: photo.uri,
                    name: "receipt.jpg",
                    type: "image/jpeg",
                } as any
            );

            // IMPORTANT:
            // AI extraction ONLY.
            // It does NOT create an expense.
            const response = await api.post(
                "/expenses/extract",
                formData,
                {
                    headers: {
                        "Content-Type":
                            "multipart/form-data",
                    },
                }
            );

            const extracted =
                response.data.extracted;

            setVendor(
                extracted.vendor ?? ""
            );

            setAmount(
                extracted.total_amount != null
                    ? String(extracted.total_amount)
                    : ""
            );

            setExpenseDate(
                extracted.purchase_date ??
                new Date()
                    .toISOString()
                    .split("T")[0]
            );

            setTaxCode(
                extracted.line_items?.[0]
                    ?.tax_code ??
                extracted.tax_code ??
                ""
            );

            setNotes(
                extracted.notes ?? ""
            );

            setReceiptId(
                response.data.receipt_id
            );

            setShowCamera(false);

            Alert.alert(
                "Receipt scanned",
                "Please review the extracted details before saving."
            );
        } catch (error: any) {
            const message =
                error.response?.status === 402
                    ? "You've hit your free-tier scan limit this month."
                    : "Couldn't read that receipt. Try a clearer photo.";

            Alert.alert(
                "Scan failed",
                message
            );
        } finally {
            setProcessing(false);
        }
    };

    // --------------------------------------------------
    // SAVE EXPENSE
    // --------------------------------------------------

    const saveExpense = async () => {
        if (!vendor.trim()) {
            Alert.alert(
                "Missing vendor",
                "Please enter the vendor."
            );
            return;
        }

        const numericAmount =
            parseFloat(amount);

        if (
            !amount ||
            Number.isNaN(numericAmount) ||
            numericAmount <= 0
        ) {
            Alert.alert(
                "Invalid amount",
                "Please enter a valid amount."
            );
            return;
        }

        if (!expenseDate) {
            Alert.alert(
                "Missing date",
                "Please enter the expense date."
            );
            return;
        }

        if (!taxCode.trim()) {
            Alert.alert(
                "Missing tax code",
                "Please enter the tax code."
            );
            return;
        }

        setSaving(true);

        try {
            const month =
                expenseDate.slice(0, 7);

            const payload = {
                vendor: vendor.trim(),
                amount: numericAmount,
                expense_date: expenseDate,
                tax_code: taxCode.trim(),
                is_deductible: isDeductible,
                notes: notes.trim() || null,
                receipt_id: receiptId ?? null,
            };

            if (editingId) {
                await api.patch(
                    `/expenses/${month}/${editingId}`,
                    payload
                );
            } else {
                await api.post(
                    `/expenses/${month}`,
                    payload
                );
            }

            Alert.alert(
                "Success",
                editingId
                    ? "Expense updated."
                    : "Expense added.",
                [
                    {
                        text: "OK",
                        onPress: () =>
                            navigation.goBack(),
                    },
                ]
            );
        } catch (error: any) {
            console.log(
                "Save expense error:",
                error
            );

            Alert.alert(
                "Couldn't save",
                "Please try again."
            );
        } finally {
            setSaving(false);
        }
    };

    // --------------------------------------------------
    // DELETE
    // --------------------------------------------------

    const deleteExpense = () => {
        if (!editingId) return;

        Alert.alert(
            "Delete expense?",
            "This expense will be removed and your Safe to Spend amount will increase accordingly.",
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
                            const month =
                                expenseDate.slice(0, 7);

                            await api.delete(
                                `/expenses/${month}/${editingId}`
                            );

                            navigation.goBack();
                        } catch (error) {
                            Alert.alert(
                                "Couldn't delete",
                                "Please try again."
                            );
                        }
                    },
                },
            ]
        );
    };

    // --------------------------------------------------
    // CAMERA PERMISSION
    // --------------------------------------------------

    if (!permission) {
        return <View />;
    }

    if (
        showCamera &&
        !permission.granted
    ) {
        return (
            <View style={styles.centered}>
                <Text style={styles.permissionText}>
                    We need camera access to scan receipts.
                </Text>

                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={requestPermission}
                >
                    <Text style={styles.primaryButtonText}>
                        Grant Permission
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    // --------------------------------------------------
    // CAMERA
    // --------------------------------------------------

    if (showCamera) {
        return (
            <View style={styles.cameraContainer}>
                <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing="back"
                />

                {processing ? (
                    <View style={styles.cameraLoading}>
                        <ActivityIndicator
                            size="large"
                            color="#fff"
                        />

                        <Text
                            style={
                                styles.cameraLoadingText
                            }
                        >
                            Reading receipt...
                        </Text>
                    </View>
                ) : (
                    <>
                        <TouchableOpacity
                            style={styles.closeCamera}
                            onPress={() =>
                                setShowCamera(false)
                            }
                        >
                            <Text style={styles.closeText}>
                                Cancel
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.captureButton}
                            onPress={takePhoto}
                        />
                    </>
                )}
            </View>
        );
    }

    // --------------------------------------------------
    // EXPENSE FORM
    // --------------------------------------------------

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={
                    styles.content
                }
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>
                    {editingId
                        ? "Edit Expense"
                        : "Add Expense"}
                </Text>

                <Text style={styles.subtitle}>
                    Enter the expense manually or scan a receipt.
                </Text>

                {/* AI SCAN */}

                <TouchableOpacity
                    style={styles.scanButton}
                    onPress={() => {
                        Alert.alert(
                            "Scan Receipt",
                            "Choose how you want to add your receipt",
                            [
                                {
                                    text: "📷 Take Photo",
                                    onPress: async () => {
                                        if (!permission.granted) {
                                            const result = await requestPermission();

                                            if (!result.granted) {
                                                return;
                                            }
                                        }

                                        setShowCamera(true);
                                    },
                                },
                                {
                                    text: "🖼️ Choose from Gallery",
                                    onPress: pickReceipt,
                                },
                                {
                                    text: "Cancel",
                                    style: "cancel",
                                },
                            ]
                        );
                    }}
                >
                    <Text style={styles.scanButtonText}>
                        📷 Scan Receipt
                    </Text>
                </TouchableOpacity>

                <View style={styles.separatorRow}>
                    <View
                        style={styles.separator}
                    />

                    <Text
                        style={styles.orText}
                    >
                        OR ENTER MANUALLY
                    </Text>

                    <View
                        style={styles.separator}
                    />
                </View>

                {/* VENDOR */}

                <Text style={styles.label}>
                    Vendor
                </Text>

                <TextInput
                    value={vendor}
                    onChangeText={setVendor}
                    placeholder="e.g. Starbucks"
                    placeholderTextColor={
                        colors.textSecondary
                    }
                    style={styles.input}
                />

                {/* AMOUNT */}

                <Text style={styles.label}>
                    Amount
                </Text>

                <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    placeholderTextColor={
                        colors.textSecondary
                    }
                    keyboardType="decimal-pad"
                    style={styles.input}
                />

                {/* DATE */}

                <Text style={styles.label}>
                    Date
                </Text>

                <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.8}
                >
                    <Text
                        style={{
                            color: expenseDate
                                ? colors.textPrimary
                                : colors.textSecondary,
                            fontSize: 16,
                        }}
                    >
                        {expenseDate || "Select date"}
                    </Text>
                </TouchableOpacity>

                {showDatePicker && (
                    <DateTimePicker
                        value={
                            expenseDate
                                ? new Date(`${expenseDate}T00:00:00`)
                                : new Date()
                        }
                        mode="date"
                        display="default"
                        maximumDate={new Date()}
                        onChange={(event, selectedDate) => {
                            setShowDatePicker(false);

                            if (selectedDate) {
                                const year = selectedDate.getFullYear();
                                const month = String(
                                    selectedDate.getMonth() + 1
                                ).padStart(2, "0");
                                const day = String(
                                    selectedDate.getDate()
                                ).padStart(2, "0");

                                setExpenseDate(
                                    `${year}-${month}-${day}`
                                );
                            }
                        }}
                    />
                )}

                {/* TAX CODE */}

                <Text style={styles.label}>
                    Tax Code
                </Text>

                <TextInput
                    value={taxCode}
                    onChangeText={setTaxCode}
                    placeholder="e.g. FOOD"
                    placeholderTextColor={
                        colors.textSecondary
                    }
                    style={styles.input}
                />

                {/* DEDUCTIBLE */}

                <View
                    style={
                        styles.switchRow
                    }
                >
                    <View>
                        <Text style={styles.label}>
                            Tax Deductible
                        </Text>

                        <Text
                            style={
                                styles.switchDescription
                            }
                        >
                            Mark whether this expense is deductible.
                        </Text>
                    </View>

                    <Switch
                        value={isDeductible}
                        onValueChange={
                            setIsDeductible
                        }
                    />
                </View>

                {/* NOTES */}

                <Text style={styles.label}>
                    Notes
                </Text>

                <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Optional notes"
                    placeholderTextColor={
                        colors.textSecondary
                    }
                    multiline
                    numberOfLines={4}
                    style={[
                        styles.input,
                        styles.notesInput,
                    ]}
                />

                {/* SAVE */}

                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={saveExpense}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator
                            color="#fff"
                        />
                    ) : (
                        <Text
                            style={
                                styles.primaryButtonText
                            }
                        >
                            {editingId
                                ? "Save Changes"
                                : "Add Expense"}
                        </Text>
                    )}
                </TouchableOpacity>

                {/* DELETE */}

                {editingId && (
                    <TouchableOpacity
                        style={
                            styles.deleteButton
                        }
                        onPress={deleteExpense}
                    >
                        <Text
                            style={
                                styles.deleteButtonText
                            }
                        >
                            Delete Expense
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },

    content: {
        padding: 20,
        paddingBottom: 40,
    },

    title: {
        fontSize: 28,
        fontWeight: "700",
        color: colors.textPrimary,
        marginBottom: 6,
    },

    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 20,
    },

    scanButton: {
        backgroundColor: colors.teal,
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
        marginBottom: 24,
    },

    scanButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },

    separatorRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 20,
    },

    separator: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
    },

    orText: {
        fontSize: 11,
        color: colors.textSecondary,
        marginHorizontal: 10,
        fontWeight: "600",
    },

    label: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.textPrimary,
        marginBottom: 7,
        marginTop: 14,
    },

    input: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 13,
        fontSize: 15,
        color: colors.textPrimary,
    },

    notesInput: {
        minHeight: 100,
        textAlignVertical: "top",
    },

    switchRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 12,
    },

    switchDescription: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },

    primaryButton: {
        backgroundColor: colors.navy,
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
        marginTop: 24,
    },

    primaryButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },

    deleteButton: {
        borderWidth: 1,
        borderColor: "#d9534f",
        borderRadius: 12,
        padding: 15,
        alignItems: "center",
        marginTop: 12,
    },

    deleteButtonText: {
        color: "#d9534f",
        fontWeight: "700",
    },

    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        backgroundColor: colors.background,
    },

    permissionText: {
        textAlign: "center",
        marginBottom: 16,
        color: colors.textPrimary,
    },

    cameraContainer: {
        flex: 1,
        backgroundColor: "#000",
    },

    camera: {
        flex: 1,
    },

    captureButton: {
        position: "absolute",
        bottom: 40,
        alignSelf: "center",
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "#fff",
        borderWidth: 4,
        borderColor: colors.teal,
    },

    closeCamera: {
        position: "absolute",
        top: 50,
        left: 20,
        backgroundColor: "rgba(0,0,0,0.6)",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },

    closeText: {
        color: "#fff",
        fontWeight: "600",
    },

    cameraLoading: {
        position: "absolute",
        inset: 0,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
    },

    cameraLoadingText: {
        color: "#fff",
        marginTop: 12,
        fontSize: 16,
    },
});