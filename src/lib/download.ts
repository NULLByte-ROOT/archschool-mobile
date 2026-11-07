import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { Alert, Platform, Share } from "react-native";

/**
 * OTA-safe image download.
 *
 * `expo-media-library` is a native module and is not part of this build, so
 * instead of the (invisible) app document directory we write the file to a
 * public place the user can actually open:
 *
 * - Android: Storage Access Framework — the user picks a folder once (the
 *   Downloads folder is suggested); the grant is persistable, so later
 *   downloads reuse it without another dialog.
 * - iOS: the native share sheet, where "Save Image" adds it to Photos.
 * - Web: a real `<a download>` (fetches a blob so cross-origin media works).
 *
 * Only `expo-file-system` + `expo-secure-store` are used, both already
 * installed, so this ships over the air without a new build.
 */

const DIRECTORY_KEY = "archschool.download.directory";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

let rememberedDirectory: string | null = null;
let downloadInFlight = false;

function extensionOf(url: string): string {
  const match = /\.([a-z0-9]{2,5})(?:\?|#|$)/i.exec(url);
  const extension = match?.[1]?.toLowerCase();
  if (!extension) return "jpg";
  return MIME_BY_EXT[extension] ? extension : "jpg";
}

function fileNameFor(url: string): string {
  const extension = extensionOf(url);
  return `archschool_${Date.now()}.${extension}`;
}

function mimeFor(extension: string): string {
  return MIME_BY_EXT[extension] ?? "image/jpeg";
}

/** Android: write `sourceUri` into the granted SAF directory. */
async function writeToSafDirectory(
  directoryUri: string,
  fileName: string,
  mimeType: string,
  sourceUri: string
): Promise<string> {
  const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
    directoryUri,
    fileName,
    mimeType
  );
  try {
    const base64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.StorageAccessFramework.writeAsStringAsync(
      targetUri,
      base64,
      { encoding: FileSystem.EncodingType.Base64 }
    );
    return targetUri;
  } catch (error) {
    // Never leave a half-written file behind in the user's folder.
    await FileSystem.StorageAccessFramework.deleteAsync(targetUri, {
      idempotent: true,
    }).catch(() => undefined);
    throw error;
  }
}

async function saveOnAndroid(
  sourceUri: string,
  fileName: string,
  mimeType: string
): Promise<boolean> {
  let directory =
    rememberedDirectory ??
    (await SecureStore.getItemAsync(DIRECTORY_KEY).catch(() => null));

  // Reuse the folder the user picked before while the grant is still valid.
  if (directory) {
    try {
      await writeToSafDirectory(directory, fileName, mimeType, sourceUri);
      rememberedDirectory = directory;
      return true;
    } catch {
      rememberedDirectory = null;
      await SecureStore.deleteItemAsync(DIRECTORY_KEY).catch(() => undefined);
    }
  }

  const permission =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
      FileSystem.StorageAccessFramework.getUriForDirectoryInRoot("Download")
    );
  if (!permission.granted) {
    Alert.alert(
      "ذخیره نشد",
      "برای ذخیرهٔ عکس باید یک پوشه (مثلاً Downloads) انتخاب کنی."
    );
    return false;
  }

  await writeToSafDirectory(
    permission.directoryUri,
    fileName,
    mimeType,
    sourceUri
  );
  rememberedDirectory = permission.directoryUri;
  await SecureStore.setItemAsync(
    DIRECTORY_KEY,
    permission.directoryUri
  ).catch(() => undefined);
  return true;
}

async function saveOnWeb(url: string, fileName: string): Promise<boolean> {
  if (typeof document === "undefined") return false;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    }
  } catch {
    // Cross-origin media without CORS: let the browser handle the URL.
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  return true;
}

/**
 * Download an image and put it somewhere the user can find it.
 * Resolves `true` when the file was saved/shared, `false` on cancel or error.
 * A second tap while a download is running is ignored.
 */
export async function downloadImage(url: string): Promise<boolean> {
  if (!url || downloadInFlight) return false;
  downloadInFlight = true;
  try {
    return await performDownload(url);
  } finally {
    downloadInFlight = false;
  }
}

async function performDownload(url: string): Promise<boolean> {
  const fileName = fileNameFor(url);
  const mimeType = mimeFor(extensionOf(url));

  if (Platform.OS === "web") {
    return saveOnWeb(url, fileName);
  }

  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) {
    Alert.alert("خطا", "حافظهٔ موقت در دسترس نیست.");
    return false;
  }

  const temporaryUri = `${cacheDirectory}${fileName}`;
  try {
    const { uri } = await FileSystem.downloadAsync(url, temporaryUri);

    if (Platform.OS === "android") {
      const saved = await saveOnAndroid(uri, fileName, mimeType);
      if (!saved) return false;
      Alert.alert("ذخیره شد", "عکس در پوشهٔ انتخاب‌شده ذخیره شد.");
      return true;
    }

    // iOS: the share sheet can add the image to Photos.
    await Share.share({ url: uri }, { subject: fileName });
    return true;
  } catch (error) {
    console.error("Download failed:", error);
    Alert.alert("خطا", "دانلود عکس ناموفق بود. دوباره تلاش کن.");
    return false;
  } finally {
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(
      () => undefined
    );
  }
}
