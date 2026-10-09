import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

export type RootStackParamList = {
    Login: undefined;
    Onboarding: undefined;
    Home: undefined;
    Camera: undefined;
    ReceiptReview: {
        receiptId: string;
        extracted: {
            vendor?: string;
            purchase_date?: string;
            total_amount?: number;
            currency?: string;
            line_items: any[];
        };
    };
    Chat: undefined;
    ExpenseHistory: undefined;
    BalanceSetup: undefined;
    Settings: undefined;
    Obligations: undefined;
    ExpenseEntry: {
        expense?: {
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
        };
    } | undefined;
};

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;
