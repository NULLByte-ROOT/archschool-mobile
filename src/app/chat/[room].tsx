import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiError,
  clearChat,
  deleteMessage,
  fetchAssignment,
  fetchMessages,
  fetchTeam,
  markRoomRead,
  pinMessage,
  qk,
  resolveMediaUrl,
  sendMessage,
  unpinMessage,
  uploadFile,
} from "@/api/client";
import type { Message, PublicUser } from "@/api/types";
import { EmptyState } from "@/components/cards";
import { Header } from "@/components/Header";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { AppText, Avatar, Divider } from "@/components/ui";
import { useRoomSocket, type RoomSocketEvent } from "@/hooks/useRoomSocket";
import { parseRoom } from "@/lib/chat";
import {
  calendarDayDiff,
  faDate,
  parseDue,
} from "@/lib/format";
import { canChat, isStaff } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

const LOCKED = "برای دسترسی به گفتگو، از ادمین اجازه بگیرید.";

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const map = new Map<number, Message>();
  for (const message of current) map.set(message.id, message);
  for (const message of incoming) map.set(message.id, message);
  return [...map.values()].sort((a, b) => {
    const byDate = a.created_at.localeCompare(b.created_at);
    return byDate !== 0 ? byDate : a.id - b.id;
  });
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(iso: string): string {
  const date = parseDue(iso);
  if (!date) return "";
  const diff = calendarDayDiff(date, new Date());
  if (diff === 0) return "امروز";
  if (diff === -1) return "دیروز";
  return faDate(date, "full");
}

function MessageBubble({
  message,
  own,
  showAuthor,
  showDate,
  onLongPress,
  onImagePress,
}: {
  message: Message;
  own: boolean;
  showAuthor: boolean;
  showDate: boolean;
  onLongPress: () => void;
  onImagePress: (url: string) => void;
}) {
  const image = message.file_url ? resolveMediaUrl(message.file_url) : null;

  return (
    <View style={[styles.messageWrap, own ? styles.ownWrap : styles.otherWrap]}>
      {showDate ? (
        <View style={styles.dayChip}>
          <AppText variant="caption" color={colors.faint} style={{ fontSize: 10 }}>
            {dayLabel(message.created_at)}
          </AppText>
        </View>
      ) : null}

      <View style={[styles.messageRow, own ? styles.ownRow : styles.otherRow]}>
        {!own ? (
          showAuthor ? (
            <Avatar name={message.sender_username} uri={message.sender_avatar_url} size="xs" />
          ) : (
            <View style={{ width: 28 }} />
          )
        ) : null}

        <View style={{ maxWidth: "80%", gap: 3 }}>
          {!own && showAuthor ? (
            <AppText variant="caption" color={colors.amber} style={{ fontFamily: fonts.medium }}>
              {message.sender_username ?? "همکلاسی"}
            </AppText>
          ) : null}

          <Pressable
            onLongPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => undefined
              );
              onLongPress();
            }}
            delayLongPress={280}
            style={[
              styles.bubble,
              own ? styles.ownBubble : styles.otherBubble,
            ]}
          >
            {message.reply_to ? (
              <View style={styles.replyQuote}>
                <View style={styles.replyBar} />
                <View style={{ flex: 1, gap: 1 }}>
                  <AppText variant="caption" color={colors.amber} style={{ fontFamily: fonts.medium }}>
                    {message.reply_to.sender_username ?? "پیام"}
                  </AppText>
                  <AppText variant="caption" color={colors.muted} numberOfLines={1}>
                    {message.reply_to.content.trim() || "📷 تصویر"}
                  </AppText>
                </View>
              </View>
            ) : null}

            {image ? (
              <Pressable onPress={() => onImagePress(image)}>
                <Image
                  source={{ uri: image }}
                  style={styles.messageImage}
                  contentFit="cover"
                  transition={160}
                  cachePolicy="memory-disk"
                />
              </Pressable>
            ) : null}

            {message.content.trim() ? (
              <AppText variant="body" color={colors.text} style={styles.messageText}>
                {message.content}
              </AppText>
            ) : null}

            <View style={styles.messageMeta}>
              {message.is_pinned ? (
                <Ionicons name="pin" size={10} color={colors.amber} />
              ) : null}
              <AppText variant="caption" color={colors.faint} ltr style={{ fontSize: 9.5 }}>
                {faDate(message.created_at, "time")}
              </AppText>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function ChatRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const params = useLocalSearchParams<{ room?: string | string[] }>();
  const room = Array.isArray(params.room) ? params.room[0] : (params.room ?? "");

  const parsed = useMemo(() => parseRoom(room, user?.id), [room, user?.id]);
  const blocked = !canChat(user) && parsed.kind !== "assignment";

  const scope =
    parsed.kind === "dm" ? "private" : parsed.kind === "assignment" ? "assignment" : "global";
  const peerId = parsed.kind === "dm" ? parsed.peerId : undefined;
  const assignmentId = parsed.kind === "assignment" ? parsed.assignmentId : undefined;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesQuery = useQuery({
    queryKey: qk.messages(room),
    queryFn: () =>
      fetchMessages({ scope, peerId, assignmentId, limit: 120 }),
    enabled: Boolean(room) && !blocked,
  });

  const team = useQuery({
    queryKey: qk.team,
    queryFn: fetchTeam,
    enabled: parsed.kind === "dm" && !blocked,
  });

  const assignment = useQuery({
    queryKey: qk.assignment(assignmentId ?? 0),
    queryFn: () => fetchAssignment(assignmentId ?? 0),
    enabled: Boolean(assignmentId) && !blocked,
  });

  useEffect(() => {
    setMessages([]);
    setInput("");
    setReplyTo(null);
    setPendingImage(null);
  }, [room]);

  useEffect(() => {
    if (messagesQuery.data) {
      setMessages((current) => mergeMessages(current, messagesQuery.data));
    }
  }, [messagesQuery.data]);

  const markRead = () => {
    if (!room || blocked) return;
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      markRoomRead(room)
        .then(() => queryClient.invalidateQueries({ queryKey: qk.unread }))
        .catch(() => undefined);
    }, 500);
  };

  useEffect(() => {
    markRead();
    return () => {
      if (readTimer.current) clearTimeout(readTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, messages.length]);

  const onSocketEvent = (event: RoomSocketEvent) => {
    if (event.type === "delete") {
      setMessages((current) => current.filter((message) => message.id !== event.id));
    } else if (event.type === "clear") {
      setMessages([]);
    } else if (event.type === "pin") {
      setMessages((current) =>
        current.map((message) => ({
          ...message,
          is_pinned: message.id === event.message.id,
        }))
      );
    }
  };

  const { connected } = useRoomSocket(blocked ? null : room || null, {
    onMessage: (message) =>
      setMessages((current) => mergeMessages(current, [message])),
    onEvent: onSocketEvent,
  });

  const peer: PublicUser | undefined =
    peerId !== undefined
      ? team.data?.find((person) => person.id === peerId)
      : undefined;

  const title =
    parsed.kind === "assignment"
      ? assignment.data?.title ?? "کامنت تکلیف"
      : parsed.kind === "dm"
        ? peer?.username ?? "گفتگوی خصوصی"
        : "گفتگوی کلاس";

  const subtitle =
    parsed.kind === "assignment"
      ? "اتاق کامنت تکلیف"
      : parsed.kind === "dm"
        ? "خصوصی"
        : "گروه کلاس";

  const canDelete = isStaff(user);
  const pinned = messages.find((message) => message.is_pinned);

  const pickImage = async () => {
    if (sending) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsMultipleSelection: false,
      });
      if (!result.canceled && result.assets[0]) {
        setPendingImage(result.assets[0]);
      }
    } catch {
      Alert.alert("تصویر", "انتخاب تصویر ممکن نشد.");
    }
  };

  const send = async () => {
    if (sending || blocked) return;
    const text = input.trim();
    if (!text && !pendingImage) return;

    setSending(true);
    try {
      let fileUrl: string | null = null;
      if (pendingImage) {
        const uploaded = await uploadFile({
          uri: pendingImage.uri,
          name: pendingImage.fileName ?? `chat-${Date.now()}.jpg`,
          type: pendingImage.mimeType ?? "image/jpeg",
          size: pendingImage.fileSize,
        });
        fileUrl = uploaded.url;
      }

      const created = await sendMessage({
        content: text,
        receiver_id: peerId ?? null,
        assignment_id: assignmentId ?? null,
        file_url: fileUrl,
        reply_to_id: replyTo?.id ?? null,
      });

      setMessages((current) => mergeMessages(current, [created]));
      setInput("");
      setReplyTo(null);
      setPendingImage(null);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => undefined
      );
      void queryClient.invalidateQueries({ queryKey: qk.chatOverview });
      void queryClient.invalidateQueries({ queryKey: qk.recentComments });
      void queryClient.invalidateQueries({ queryKey: qk.unread });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "پیام ارسال نشد. دوباره تلاش کن.";
      Alert.alert("ارسال نشد", message);
    } finally {
      setSending(false);
    }
  };

  const confirmClear = () => {
    Alert.alert(
      "پاک کردن گفتگو",
      "همهٔ پیام‌های این اتاق برای همه حذف می‌شود. مطمئنی؟",
      [
        { text: "انصراف", style: "cancel" },
        {
          text: "پاک کن",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await clearChat({ scope, peerId, assignmentId });
                setMessages([]);
                setMenuOpen(false);
                void queryClient.invalidateQueries({ queryKey: qk.messages(room) });
                void queryClient.invalidateQueries({ queryKey: qk.chatOverview });
                void queryClient.invalidateQueries({ queryKey: qk.recentComments });
                void queryClient.invalidateQueries({ queryKey: qk.unread });
              } catch (error) {
                Alert.alert(
                  "خطا",
                  error instanceof ApiError ? error.message : "پاک کردن انجام نشد."
                );
              }
            })();
          },
        },
      ]
    );
  };

  const confirmDelete = (message: Message) => {
    Alert.alert("حذف پیام", "این پیام برای همه حذف می‌شود؟", [
      { text: "انصراف", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteMessage(message.id);
              setMessages((current) => current.filter((item) => item.id !== message.id));
              setActionMessage(null);
              void queryClient.invalidateQueries({ queryKey: qk.chatOverview });
            } catch (error) {
              Alert.alert(
                "خطا",
                error instanceof ApiError ? error.message : "حذف انجام نشد."
              );
            }
          })();
        },
      },
    ]);
  };

  const togglePin = async (message: Message) => {
    try {
      const updated = message.is_pinned
        ? await unpinMessage(message.id)
        : await pinMessage(message.id);
      setMessages((current) =>
        current.map((item) => ({
          ...item,
          // The backend keeps at most one pinned message per room; mirror that
          // locally instead of leaving the previous pin highlighted.
          is_pinned: item.id === updated.id ? updated.is_pinned : false,
        }))
      );
      setActionMessage(null);
    } catch (error) {
      Alert.alert(
        "خطا",
        error instanceof ApiError ? error.message : "پین کردن انجام نشد."
      );
    }
  };

  const canSend = Boolean(input.trim() || pendingImage) && !sending;
  const data = useMemo(() => [...messages].reverse(), [messages]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const older = data[index + 1];
    const showAuthor = !older || older.sender_id !== item.sender_id;
    const showDate = !older || dayKey(older.created_at) !== dayKey(item.created_at);
    return (
      <MessageBubble
        message={item}
        own={item.sender_id === user?.id}
        showAuthor={showAuthor}
        showDate={showDate}
        onLongPress={() => setActionMessage(item)}
        onImagePress={setViewerUrl}
      />
    );
  };

  if (blocked) {
    return (
      <Screen edges={["top", "bottom"]}>
        <Header title="گفتگو" onBack={() => router.back()} />
        <View style={styles.center}>
          <EmptyState
            icon="lock-closed-outline"
            title="گفتگو قفل است"
            hint={LOCKED}
            actionLabel="بازگشت"
            onAction={() => router.back()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]}>
      <Header
        title={title}
        subtitle={`${subtitle} · ${connected ? "متصل" : "در حال اتصال…"}`}
        onBack={() => router.back()}
        actions={
          canDelete ? (
            <Pressable
              onPress={() => setMenuOpen(true)}
              style={styles.headerAction}
              hitSlop={8}
              accessibilityLabel="مدیریت گفتگو"
            >
              <Ionicons name="ellipsis-horizontal" size={19} color={colors.text} />
            </Pressable>
          ) : null
        }
      />

      {pinned ? (
        <View style={styles.pinnedBar}>
          <Ionicons name="pin" size={13} color={colors.amber} />
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <AppText variant="caption" color={colors.amber} style={{ fontFamily: fonts.medium }}>
              پیام پین‌شده
            </AppText>
            <AppText variant="caption" color={colors.muted} numberOfLines={1}>
              {pinned.content.trim() || "📷 تصویر"}
            </AppText>
          </View>
          <AppText variant="caption" color={colors.faint}>
            {pinned.sender_username ?? ""}
          </AppText>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {messagesQuery.isLoading ? (
          <View style={styles.center}>
            <AppText variant="caption" color={colors.muted}>
              در حال بارگذاری گفتگو…
            </AppText>
          </View>
        ) : messagesQuery.isError && messages.length === 0 ? (
          <View style={styles.center}>
            <EmptyState
              icon="cloud-offline-outline"
              title="گفتگو باز نشد"
              hint={
                messagesQuery.error instanceof ApiError
                  ? messagesQuery.error.message
                  : "اتصال اینترنت را بررسی کنید."
              }
              actionLabel="تلاش دوباره"
              onAction={() => void messagesQuery.refetch()}
            />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.center}>
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title="اولین پیام را بفرست"
              hint={
                parsed.kind === "assignment"
                  ? "این اتاق مخصوص کامنت همین تکلیف است."
                  : "سلامی بفرست تا گفتگو شروع شود."
              }
            />
          </View>
        ) : (
          <FlashList<Message>
            data={data}
            inverted
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          />
        )}

        {replyTo ? (
          <View style={styles.composerNote}>
            <View style={styles.replyBar} />
            <View style={{ flex: 1, gap: 1 }}>
              <AppText variant="caption" color={colors.amber} style={{ fontFamily: fonts.medium }}>
                پاسخ به {replyTo.sender_username ?? "پیام"}
              </AppText>
              <AppText variant="caption" color={colors.muted} numberOfLines={1}>
                {replyTo.content.trim() || "📷 تصویر"}
              </AppText>
            </View>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.muted} />
            </Pressable>
          </View>
        ) : null}

        {pendingImage ? (
          <View style={styles.composerNote}>
            <Image
              source={{ uri: pendingImage.uri }}
              style={styles.pendingThumb}
              contentFit="cover"
            />
            <AppText variant="caption" color={colors.muted} numberOfLines={1} style={{ flex: 1 }}>
              تصویر آمادهٔ ارسال است
            </AppText>
            <Pressable onPress={() => setPendingImage(null)} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.muted} />
            </Pressable>
          </View>
        ) : null}

        <View
          style={[
            styles.composer,
            { paddingBottom: Math.max(insets.bottom, 10) },
          ]}
        >
          <Pressable
            onPress={() => void pickImage()}
            style={styles.attach}
            hitSlop={6}
            accessibilityLabel="پیوست تصویر"
          >
            <Ionicons name="image-outline" size={21} color={colors.amber} />
          </Pressable>

          <View style={styles.inputWrap}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="پیام…"
              placeholderTextColor={colors.faint}
              multiline
              maxLength={4000}
              selectionColor={colors.amber}
              style={styles.input}
              textAlignVertical="center"
            />
          </View>

          <Pressable
            onPress={() => void send()}
            disabled={!canSend}
            style={[
              styles.send,
              {
                backgroundColor: canSend ? colors.amber : "rgba(255,255,255,0.06)",
              },
            ]}
            accessibilityLabel="ارسال"
          >
            <Ionicons
              name="send"
              size={18}
              color={canSend ? "#171004" : colors.faint}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Sheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="مدیریت گفتگو"
        subtitle="فقط ادمین و Owner"
      >
        <Pressable
          onPress={confirmClear}
          style={styles.menuRow}
        >
          <View style={[styles.menuIcon, { backgroundColor: colors.redSoft, borderColor: "rgba(242,104,107,0.3)" }]}>
            <Ionicons name="trash-outline" size={17} color={colors.red} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <AppText variant="label" color={colors.red} style={{ fontFamily: fonts.semibold }}>
              پاک کردن کل گفتگو
            </AppText>
            <AppText variant="caption" color={colors.faint}>
              همهٔ پیام‌ها برای همهٔ اعضا حذف می‌شود.
            </AppText>
          </View>
        </Pressable>
        <Divider />
        <View style={styles.menuNote}>
          <Ionicons name="information-circle-outline" size={13} color={colors.faint} />
          <AppText variant="caption" color={colors.faint} style={{ flex: 1 }}>
            برای حذف یک پیام، انگشت را روی همان پیام نگه دار.
          </AppText>
        </View>
      </Sheet>

      <Sheet
        visible={actionMessage !== null}
        onClose={() => setActionMessage(null)}
        title="پیام"
        subtitle={actionMessage?.sender_username ?? undefined}
      >
        {actionMessage ? (
          <>
            <View style={styles.actionPreview}>
              <AppText variant="body" color={colors.textSoft} numberOfLines={4}>
                {actionMessage.content.trim() || "📷 تصویر"}
              </AppText>
            </View>

            <Pressable
              onPress={() => {
                setReplyTo(actionMessage);
                setActionMessage(null);
              }}
              style={styles.menuRow}
            >
              <View style={styles.menuIcon}>
                <Ionicons name="arrow-undo-outline" size={17} color={colors.amber} />
              </View>
              <AppText variant="label" style={{ flex: 1 }}>
                پاسخ به این پیام
              </AppText>
            </Pressable>

            {canDelete ? (
              <>
                <Divider />
                <Pressable
                  onPress={() => void togglePin(actionMessage)}
                  style={styles.menuRow}
                >
                  <View style={styles.menuIcon}>
                    <Ionicons
                      name={actionMessage.is_pinned ? "pin-outline" : "pin"}
                      size={17}
                      color={colors.amber}
                    />
                  </View>
                  <AppText variant="label" style={{ flex: 1 }}>
                    {actionMessage.is_pinned ? "برداشتن پین" : "پین کردن پیام"}
                  </AppText>
                </Pressable>
                <Divider />
                <Pressable
                  onPress={() => confirmDelete(actionMessage)}
                  style={styles.menuRow}
                >
                  <View style={[styles.menuIcon, { backgroundColor: colors.redSoft, borderColor: "rgba(242,104,107,0.3)" }]}>
                    <Ionicons name="trash-outline" size={17} color={colors.red} />
                  </View>
                  <AppText variant="label" color={colors.red} style={{ flex: 1 }}>
                    حذف پیام
                  </AppText>
                </Pressable>
              </>
            ) : null}
          </>
        ) : null}
      </Sheet>

      <Modal
        visible={viewerUrl !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewerUrl(null)}
      >
        <View style={styles.viewer}>
          <Pressable
            onPress={() => setViewerUrl(null)}
            style={[styles.viewerClose, { top: insets.top + 12 }]}
            hitSlop={10}
          >
            <Ionicons name="close" size={22} color={colors.white} />
          </Pressable>
          {viewerUrl ? (
            <Image
              source={{ uri: viewerUrl }}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
            />
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  pinnedBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.amberLine,
    backgroundColor: colors.amberSoft,
  },
  listContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  messageWrap: { width: "100%" },
  ownWrap: { alignItems: "flex-start" },
  otherWrap: { alignItems: "flex-end" },
  dayChip: {
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.line,
    marginVertical: 6,
  },
  messageRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 6,
    marginVertical: 1.5,
  },
  ownRow: { justifyContent: "flex-start" },
  otherRow: { justifyContent: "flex-end" },
  bubble: {
    paddingHorizontal: spacing.sm,
    paddingTop: 7,
    paddingBottom: 5,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
    overflow: "hidden",
  },
  ownBubble: {
    backgroundColor: "rgba(242,180,85,0.15)",
    borderColor: "rgba(242,180,85,0.28)",
    borderBottomLeftRadius: 6,
  },
  otherBubble: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderBottomRightRadius: 6,
  },
  messageText: { fontSize: 14.5, lineHeight: 23 },
  messageMeta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
  },
  replyQuote: {
    flexDirection: "row-reverse",
    alignItems: "stretch",
    gap: 6,
    padding: 5,
    borderRadius: radius.xs,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  replyBar: {
    width: 2.5,
    borderRadius: 2,
    backgroundColor: colors.amber,
  },
  messageImage: {
    width: 214,
    height: 178,
    borderRadius: radius.sm,
    backgroundColor: colors.inkRaised,
  },
  composerNote: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    marginHorizontal: spacing.sm,
    marginBottom: 4,
    padding: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(12,21,34,0.92)",
  },
  pendingThumb: { width: 38, height: 38, borderRadius: radius.xs },
  composer: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.inkRaised,
  },
  attach: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberLine,
  },
  inputWrap: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: spacing.sm,
    minHeight: 42,
    justifyContent: "center",
  },
  input: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 21,
    paddingTop: 8,
    paddingBottom: 8,
    maxHeight: 112,
    textAlign: "right",
    writingDirection: "rtl",
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  menuRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberLine,
  },
  menuNote: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  actionPreview: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  viewer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerClose: {
    position: "absolute",
    left: 16,
    zIndex: 2,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
});
