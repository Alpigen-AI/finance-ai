import React from "react";
import Svg, { Path, Line, Circle, G } from "react-native-svg";

export function LogoMark({ size = 28 }: { size?: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 500 500">
            <Path
                d="M 250 80 L 410 330 L 370 330 L 250 145 L 180 250 L 210 250 L 250 190 L 320 295 L 130 295 L 90 330 L 250 80 Z"
                fill="#0F2A4A"
            />
            <G fill="none" stroke="#00C4CC" strokeWidth={20} strokeLinecap="round" strokeLinejoin="round">
                <Line x1="90" y1="380" x2="250" y2="300" />
                <Line x1="250" y1="300" x2="410" y2="380" />
                <Circle cx="90" cy="380" r="22" fill="#FFFFFF" stroke="#00C4CC" strokeWidth={16} />
                <Circle cx="250" cy="300" r="22" fill="#FFFFFF" stroke="#00C4CC" strokeWidth={16} />
                <Circle cx="410" cy="380" r="22" fill="#FFFFFF" stroke="#00C4CC" strokeWidth={16} />
            </G>
        </Svg>
    );
}