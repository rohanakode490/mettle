import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { ColorValue } from 'react-native';

interface IconProps {
  size?: number;
  color?: ColorValue;
  style?: any;
}

export const ChevronDownIcon = ({ size = 16, color = '#ffffff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ChevronRightIcon = ({ size = 16, color = '#ffffff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Path d="M9 5l7 7-7 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ClockIcon = ({ size = 16, color = '#ffffff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
    <Path d="M12 6v6l4 2" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const CheckmarkCircleFillIcon = ({ size = 22, color = '#10b981', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Circle cx="12" cy="12" r="10" fill={color} />
    <Path d="M8 12l3 3 5-5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const CircleOutlineIcon = ({ size = 22, color = '#ffffff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
  </Svg>
);

export const TrashIcon = ({ size = 20, color = '#ef4444', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const DragIcon = ({ size = 18, color = '#ffffff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Circle cx="8" cy="6" r="2" fill={color} />
    <Circle cx="16" cy="6" r="2" fill={color} />
    <Circle cx="8" cy="12" r="2" fill={color} />
    <Circle cx="16" cy="12" r="2" fill={color} />
    <Circle cx="8" cy="18" r="2" fill={color} />
    <Circle cx="16" cy="18" r="2" fill={color} />
  </Svg>
);

export const CalendarIcon = ({ size = 18, color = '#ffffff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="2" />
    <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const ExternalLinkIcon = ({ size = 12, color = '#ffffff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6m11-3H14m8 0v8m0-8L10 14" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const CloudIcon = ({ size = 20, color = '#ffffff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Path d="M18 10h-.7c-.2-1.9-1.8-3.4-3.8-3.4-1.2 0-2.3.6-3 1.5C9.9 7.4 9 7 8 7c-2.2 0-4 1.8-4 4 0 .2 0 .3.1.5C2.8 12.1 2 13.5 2 15c0 2.2 1.8 4 4 4h12c2.8 0 5-2.2 5-5s-2.2-5-5-5z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const UserIcon = ({ size = 20, color = '#ffffff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const DumbbellIcon = ({ size = 20, color = '#ffffff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Path d="M18 8h2a1 1 0 011 1v6a1 1 0 01-1 1h-2M6 8H4a1 1 0 00-1 1v6a1 1 0 001 1h2M6 12h12M8 6h2v12H8zm8 0h2v12h-2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ClipboardIcon = ({ size = 20, color = '#ffffff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h6m-6 4h6m-6-8h6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const HistoryIcon = ({ size = 20, color = '#ffffff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Path d="M12 8v4l3 3M3.05 11a9 9 0 11.23 4.29M3 5v6h6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ChartIcon = ({ size = 20, color = '#ffffff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Path d="M18 20V10M12 20V4M6 20v-6M3 20h18" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const SettingsIcon = ({ size = 20, color = '#ffffff', style }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
