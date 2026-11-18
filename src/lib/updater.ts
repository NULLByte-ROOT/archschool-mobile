import * as Application from "expo-application";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

import { API_BASE, ORIGIN } from "@/api/client";

const STORED_BUNDLE_ID_KEY = "archschool.active_bundle_id";
const UPDATES_CACHE_DIR = `${FileSystem.documentDirectory ?? ""}archschool_updates/`;

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
 * Reads local active bundle identifier from storage.
 */
export async function getActiveBundleId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORED_BUNDLE_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Saves active bundle identifier to storage.
 */
export async function setActiveBundleId(bundleId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORED_BUNDLE_ID_KEY, bundleId);
  } catch {
    // Ignore storage write errors on unsupported devices
  }
}

/**
 * Silently queries self-hosted FastAPI backend with 4-second timeout.
 * Gracefully resolves to "none" on network failure or timeout.
 */
export async function checkForUpdates(timeoutMs = 4000): Promise<UpdateCheckResponse> {
  const appVersion = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "1.0.0";
  const runtimeVersion =
    typeof Constants.expoConfig?.runtimeVersion === "string"
      ? Constants.expoConfig.runtimeVersion
      : appVersion;
  const currentBundleId = (await getActiveBundleId()) ?? "";

  const params = new URLSearchParams({
    platform: Platform.OS,
    runtimeVersion,
    appVersion,
    currentBundleId,
  });

  const checkUrl = `${API_BASE}/v1/updates/check?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(checkUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      return { updateType: "none", version: appVersion };
    }

    const data: UpdateCheckResponse = await res.json();
    return data;
  } catch {
    clearTimeout(timer);
    // Timeout or network offline: gracefully launch local bundle
    return { updateType: "none", version: appVersion };
  }
}

/**
 * Downloads OTA bundle and associated assets to local isolated directory.
 * Prunes obsolete bundles from phone storage once download finishes.
 */
export async function downloadOtaBundle(
  update: UpdateCheckResponse,
  onProgress?: (ratio: number) => void
): Promise<boolean> {
  if (!update.bundleId || !update.bundleUrl) return false;

  const bundleDir = `${UPDATES_CACHE_DIR}${update.bundleId}/`;
  const bundleFile = `${bundleDir}index.android.bundle`;

  try {
    // Ensure parent directories exist
    await FileSystem.makeDirectoryAsync(bundleDir, { intermediates: true });

    const fullBundleUrl = update.bundleUrl.startsWith("http")
      ? update.bundleUrl
      : `${ORIGIN}${update.bundleUrl}`;

    // Download bundle
    const downloadRes = await FileSystem.downloadAsync(fullBundleUrl, bundleFile);
    if (downloadRes.status !== 200) {
      return false;
    }

    // Download optional assets
    if (update.assets && update.assets.length > 0) {
      for (const asset of update.assets) {
        const assetUrl = asset.url.startsWith("http") ? asset.url : `${ORIGIN}${asset.url}`;
        const assetDest = `${bundleDir}${asset.key}`;
        const assetParent = assetDest.substring(0, assetDest.lastIndexOf("/"));
        await FileSystem.makeDirectoryAsync(assetParent, { intermediates: true });
        await FileSystem.downloadAsync(assetUrl, assetDest).catch(() => undefined);
      }
    }

    // Write metadata
    await FileSystem.writeAsStringAsync(
      `${bundleDir}metadata.json`,
      JSON.stringify(update, null, 2)
    );

    // Prune obsolete cached bundle folders on the phone
    await pruneClientBundleStorage(update.bundleId);

    // Save active bundle id
    await setActiveBundleId(update.bundleId);

    if (onProgress) onProgress(1);
    return true;
  } catch (error) {
    console.warn("[updater] failed to download OTA bundle", error);
    return false;
  }
}

/**
 * Removes older bundle folders from device storage so cache does not grow.
 */
async function pruneClientBundleStorage(activeBundleId: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(UPDATES_CACHE_DIR);
    if (!info.exists || !info.isDirectory) return;

    const entries = await FileSystem.readDirectoryAsync(UPDATES_CACHE_DIR);
    for (const entry of entries) {
      if (entry !== activeBundleId) {
        const oldPath = `${UPDATES_CACHE_DIR}${entry}`;
        await FileSystem.deleteAsync(oldPath, { idempotent: true }).catch(() => undefined);
      }
    }
  } catch {
    // Ignore pruning errors
  }
}

/**
 * Triggers reload of the JavaScript context to apply new bundle.
 */
export async function restartApp(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    // Fallback if reloadAsync is unavailable: alert or noop
  }
}

/**
 * Opens APK download link in external browser/installer.
 */
export async function openApkDownload(apkUrl?: string): Promise<void> {
  const target = apkUrl || "/api/v1/updates/apk/app-release.apk";
  const fullUrl = target.startsWith("http") ? target : `${ORIGIN}${target}`;
  await Linking.openURL(fullUrl).catch(() => undefined);
}
