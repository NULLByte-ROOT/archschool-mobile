import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

import { API_BASE, ORIGIN } from "@/api/client";

export interface AssetInfo {
  key: string;
  url: string;
  hash: string;
  size: number;
}

export interface UpdateCheckResponse {
  updateType: "none" | "ota" | "apk";
  version: string;
  bundleId?: string;
  bundleUrl?: string;
  bundleHash?: string;
  bundleSize?: number;
  assets?: AssetInfo[];
  mandatory?: boolean;
  minApkVersion?: string;
  apkUrl?: string;
  apkSize?: number;
  apkHash?: string;
  releaseNotes?: string;
  createdAt?: string;
  otaReady?: boolean;
}

/**
 * Checks for updates:
 * 1. Queries backend for mandatory APK binary update.
 * 2. If no APK update, checks native expo-updates for self-hosted OTA bundle.
 */
export async function checkForUpdates(
  timeoutMs = 4000,
  throwOnError = false
): Promise<UpdateCheckResponse> {
  const appVersion = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "1.0.0";
  const runtimeVersion =
    typeof Constants.expoConfig?.runtimeVersion === "string"
      ? Constants.expoConfig.runtimeVersion
      : appVersion;

  // 1. Mandatory APK check via custom endpoint
  try {
    const params = new URLSearchParams({
      platform: Platform.OS,
      runtimeVersion,
      appVersion,
    });
    const checkUrl = `${API_BASE}/v1/updates/check?${params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(checkUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data: UpdateCheckResponse = await res.json();
      if (data.updateType === "apk") {
        return data;
      }
    }
  } catch (apkErr) {
    if (throwOnError) {
      console.warn("[updater] APK check network error:", apkErr);
    }
  }

  // 2. Native Expo OTA Check
  try {
    if (Updates.isEnabled && !__DEV__) {
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        return {
          updateType: "ota",
          version: appVersion,
          otaReady: false,
          releaseNotes: "آپدیت جدید رابط کاربری و امکانات برنامه",
        };
      }
    }
  } catch (err) {
    console.warn("[updater] Updates.checkForUpdateAsync error:", err);
    if (throwOnError) {
      throw err;
    }
  }

  return { updateType: "none", version: appVersion };
}

/**
 * Downloads the OTA bundle and all assets using native expo-updates multi-threaded engine.
 */
export async function downloadOtaBundle(
  update: UpdateCheckResponse,
  onProgress?: (ratio: number) => void
): Promise<boolean> {
  try {
    if (!Updates.isEnabled || __DEV__) return false;
    const fetchRes = await Updates.fetchUpdateAsync();
    if (onProgress) onProgress(1);
    return fetchRes.isNew ?? true;
  } catch (error) {
    console.warn("[updater] failed to fetch native OTA update:", error);
    return false;
  }
}

/**
 * Triggers reload of the JavaScript context to apply new bundle.
 */
export async function restartApp(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch (err) {
    console.warn("[updater] reloadAsync error:", err);
  }
}

/**
 * Opens APK download link in external browser/installer.
 */
export async function openApkDownload(apkUrl?: string): Promise<void> {
  const target = apkUrl || "/api/v1/updates/apk/ArchSchool.apk";
  const fullUrl = target.startsWith("http") ? target : `${ORIGIN}${target}`;
  await Linking.openURL(fullUrl).catch(() => undefined);
}
