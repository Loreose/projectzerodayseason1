import type { ComponentType } from "react";
import { FaEye, FaBitcoin, FaTablet, FaSkull } from "react-icons/fa";
import { FaLocationPin, FaShield } from "react-icons/fa6";

export type PhoneAppId =
  | "OmniWatch" | "MDT" | "Darkweb" | "VPN" | "EchoTrace" | "CryptoWallet";

export interface PhoneAppDescriptor {
  id: PhoneAppId;
  label: string;
  iconBg: string;
  icon: ComponentType<{ className?: string }>;
  gridCol?: number;
}

export const PHONE_APPS: Record<PhoneAppId, PhoneAppDescriptor> = {
  OmniWatch: {
    id: "OmniWatch",
    label: "OmniWatch",
    iconBg: "from-rose-500/20 to-rose-500/30",
    icon: FaEye,
  },
  MDT: {
    id: "MDT",
    label: "MDT",
    iconBg: "from-blue-500/20 to-blue-500/30",
    icon: FaTablet,
  },
  Darkweb: {
    id: "Darkweb",
    label: "Darkweb",
    iconBg: "from-emerald-500/20 to-emerald-500/30",
    icon: FaSkull,
  },
  VPN: {
    id: "VPN",
    label: "Shadow VPN",
    iconBg: "from-purple-500/20 to-purple-500/30",
    icon: FaShield,
  },
  EchoTrace: {
    id: "EchoTrace",
    label: "EchoTrace",
    iconBg: "from-orange-500/20 to-orange-500/30",
    icon: FaLocationPin,
  },
  CryptoWallet: {
    id: "CryptoWallet",
    label: "Wallet",
    iconBg: "from-yellow-500/20 to-yellow-500/30",
    icon: FaBitcoin,
  },
};

export interface CameraEntry {
  id: string;
  name: string;
  street: string;
  feed: string;
}

export interface CryptoTransaction {
  id: string;
  type: "receive" | "send";
  amount: number;
  title: string;
  fromTo: string;
  date?: string;
}

export interface PhoneAppEpisodeData {
  label?: string;
  locked?: boolean;
  cameras?: CameraEntry[];
  requiredIp?: string;
  balance?: number;
  transactions?: CryptoTransaction[];
  records?: any[];
}

export interface EpisodePhoneConfig {
  enabled: boolean;
  appData?: Partial<Record<PhoneAppId, PhoneAppEpisodeData>>;
}

export const DEFAULT_PHONE_CONFIG: EpisodePhoneConfig = {
  enabled: false,
};
