import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ComponentRef, type ReactNode } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated2, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiError,
  clearChat,
  deleteMessage,
  editMessage,
  fetchAssignment,
  fetchMessages,
  fetchTeam,
  markMessageRead,
  markRoomRead,
  pinMessage,
  qk,
  readRoomBatch,
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
import { UserProfileModal } from "@/components/UserProfileModal";
import { useRoomSocket, type RoomSocketEvent } from "@/hooks/useRoomSocket";
import { dmRoom, parseRoom } from "@/lib/chat";
import {
  calendarDayDiff,
  faDate,
  parseDue,
} from "@/lib/format";
import { canChat, isStaff } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

const LOCKED = "برای دسترسی به گفتگو، از ادمین اجازه بگیرید.";
const SEND_FADE_MS = 150;

/** A long-press menu anchored to the touch point (Telegram's inline menu). */
interface MenuAnchor {
  message: Message;
  x: number;
  y: number;
}

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

/**
 * Swipe-to-reply (Telegram behaviour). The gesture is only claimed once the
 * finger has moved horizontally more than vertically, so vertical scrolling and
 * long-press still work normally inside the inverted FlashList.
 *
 * Layout is mirrored RTL: incoming bubbles hug the left edge, so they are
 * swiped to the right (towards the centre) — the direction the app's users
 * expect. Outgoing bubbles sit on the right and reply on a leftward swipe.
 */
function SwipeReply({
  children,
  onReply,
  maxWidth,
  own,
}: {
  children: ReactNode;
  onReply: () => void;
  maxWidth: string | number;
  own: boolean;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const armed = useRef(false);
  const inward = own ? -1 : 1;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 12 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 12 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gesture) => {
          const towardCentre = gesture.dx * inward;
          // Inward drag follows the finger (capped); outward is rubber-banded
          // so the bubble never leaves the screen.
          const next =
            towardCentre > 0
              ? inward * Math.min(towardCentre, 88)
              : Math.max(Math.min(gesture.dx * 0.35, 30), -30);
          tx.setValue(next);
          armed.current = towardCentre > 58;
        },
        onPanResponderRelease: () => {
          if (armed.current) {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => undefined
            );
            onReply();
          }
          armed.current = false;
          Animated.spring(tx, {
            toValue: 0,
            useNativeDriver: true,
            speed: 20,
            bounciness: 5,
          }).start();
        },
        onPanResponderTerminate: () => {
          armed.current = false;
          Animated.spring(tx, {
            toValue: 0,
            useNativeDriver: true,
            speed: 20,
            bounciness: 5,
          }).start();
        },
      }),
    [inward, onReply, tx]
  );

  const hintStyle = {
    opacity: tx.interpolate({
      inputRange: own ? [-58, -16, 0] : [0, 16, 58],
      outputRange: own ? [1, 0.4, 0] : [0, 0.4, 1],
      extrapolate: "clamp" as const,
    }),
    transform: [
      {
        scale: tx.interpolate({
          inputRange: own ? [-58, 0] : [0, 58],
          outputRange: own ? [1, 0.55] : [0.55, 1],
          extrapolate: "clamp" as const,
        }),
      },
    ],
  };

  return (
    <View style={{ maxWidth, gap: 3 }}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.swipeHint,
          own ? styles.swipeHintRight : styles.swipeHintLeft,
          hintStyle,
        ]}
      >
        <Ionicons name="arrow-undo" size={16} color="#6cb2ea" />
      </Animated.View>

      <Animated.View
        {...responder.panHandlers}
        style={{ transform: [{ translateX: tx }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

function MessageBubble({
  message,
  own,
  showAuthor,
  showDate,
  onLongPress,
  onImagePress,
  onReply,
  onProfile,
  onSeenInfo,
}: {
  message: Message;
  own: boolean;
  showAuthor: boolean;
  showDate: boolean;
  onLongPress: (point: { x: number; y: number }) => void;
  onImagePress: (url: string) => void;
  onReply: () => void;
  onProfile: (userId: number) => void;
  onSeenInfo: (message: Message) => void;
}) {
  const image = message.file_url ? resolveMediaUrl(message.file_url) : null;
  // Telegram ticks: one tick = delivered, double = at least one reader.
  const seenCount = message.seen_by?.length ?? 0;

  return (
    <View style={styles.messageWrap}>
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
            <Pressable
              onPress={() => onProfile(message.sender_id)}
              hitSlop={6}
              accessibilityLabel="پروفایل فرستنده"
            >
              <Avatar name={message.sender_username} uri={message.sender_avatar_url} size="xs" />
            </Pressable>
          ) : (
            <View style={{ width: 28 }} />
          )
        ) : null}

        <SwipeReply onReply={onReply} maxWidth={own ? "86%" : "84%"} own={own}>
          {!own && showAuthor ? (
            <AppText
              variant="caption"
              color="#6cb2ea"
              style={{ fontFamily: fonts.medium }}
              onPress={() => onProfile(message.sender_id)}
            >
              {message.sender_username ?? "همکلاسی"}
            </AppText>
          ) : null}

          <Pressable
            onLongPress={(event) => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => undefined
              );
              onLongPress({
                x: event.nativeEvent.pageX,
                y: event.nativeEvent.pageY,
              });
            }}
            delayLongPress={260}
            style={[
              styles.bubble,
              own ? styles.ownBubble : styles.otherBubble,
            ]}
          >
            {message.reply_to ? (
              <View style={styles.replyQuote}>
                <View style={styles.replyBar} />
                <View style={{ flex: 1, gap: 1 }}>
                  <AppText variant="caption" color="#6cb2ea" style={{ fontFamily: fonts.medium }}>
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
              {message.edited_at ? (
                <AppText variant="caption" color={colors.faint} style={{ fontSize: 9 }}>
                  ویرایش‌شده
                </AppText>
              ) : null}
              <AppText variant="caption" color={colors.faint} ltr style={{ fontSize: 9.5 }}>
                {faDate(message.created_at, "time")}
              </AppText>
              {own ? (
                <Pressable
                  onPress={() => onSeenInfo(message)}
                  hitSlop={8}
                  style={styles.tickButton}
                  accessibilityLabel={
                    seenCount > 0
                      ? `دیده‌شده توسط ${seenCount} نفر`
                      : "ارسال شد"
                  }
                >
                  <Ionicons
                    name={seenCount > 0 ? "checkmark-done" : "checkmark"}
                    size={13}
                    color={seenCount > 0 ? colors.accent : colors.faint}
                  />
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </SwipeReply>
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
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [infoMessage, setInfoMessage] = useState<Message | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [forwardFor, setForwardFor] = useState<Message | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const [editTarget, setEditTarget] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const window = useWindowDimensions();
  const pendingSends = useRef(new Set<number>());

  const messagesQuery = useQuery({
    queryKey: qk.messages(room),
    queryFn: () =>
      fetchMessages({ scope, peerId, assignmentId, limit: 120 }),
    enabled: Boolean(room) && !blocked,
  });

  const team = useQuery({
    queryKey: qk.team,
    queryFn: fetchTeam,
    // Needed for the DM header and for "forward to…" in every room type.
    enabled: !blocked,
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

  // Opening a room writes one receipt per unseen message, so every sender's
  // single tick becomes a double tick live. The same call clears the badge.
  useEffect(() => {
    if (!room || blocked) return;
    const timer = setTimeout(() => {
      readRoomBatch(room)
        .then(() => queryClient.invalidateQueries({ queryKey: qk.unread }))
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [blocked, queryClient, room]);

  const onSocketEvent = (event: RoomSocketEvent) => {
    if (event.type === "delete") {
      setMessages((current) => current.filter((message) => message.id !== event.id));
    } else if (event.type === "clear") {
      setMessages([]);
    } else if (event.type === "edit") {
      setMessages((current) =>
        current.map((message) =>
          message.id === event.message.id ? event.message : message
        )
      );
    } else if (event.type === "pin") {
      setMessages((current) =>
        current.map((message) => ({
          ...message,
          is_pinned: message.id === event.message.id,
        }))
      );
    } else if (event.type === "read") {
      if (event.readerId === user?.id) return;
      const ids = new Set(event.messageIds);
      const receipt = {
        username: event.readerUsername,
        read_at: event.readAt,
      };
      setMessages((current) =>
        current.map((message) => {
          if (!ids.has(message.id)) return message;
          const existing = message.seen_by ?? [];
          if (
            existing.some(
              (entry) =>
                entry.username === receipt.username &&
                entry.read_at === receipt.read_at
            )
          ) {
            return message;
          }
          return { ...message, seen_by: [...existing, receipt] };
        })
      );
    }
  };

  const { connected } = useRoomSocket(blocked ? null : room || null, {
    onMessage: (message) => {
      setMessages((current) => mergeMessages(current, [message]));
      // The room is open, so this message is read the moment it arrives.
      if (message.sender_id !== user?.id) {
        void markMessageRead(message.id)
          .then(() => markRoomRead(room))
          .catch(() => undefined);
      }
    },
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

    // Optimistic bubble: the tick appears immediately, the upload (if any) and
    // the POST happen behind it, and the server row replaces it in place.
    const tempId = -Date.now();
    pendingSends.current.add(tempId);
    const optimistic: Message = {
      id: tempId,
      sender_id: user?.id ?? 0,
      sender_username: user?.username ?? null,
      sender_avatar_url: user?.avatar_url ?? null,
      receiver_id: peerId ?? null,
      assignment_id: assignmentId ?? null,
      content: text,
      file_url: pendingImage?.uri ?? null,
      reply_to: replyTo
        ? {
            id: replyTo.id,
            sender_id: replyTo.sender_id,
            sender_username: replyTo.sender_username,
            content: replyTo.content,
            file_url: replyTo.file_url,
          }
        : null,
      is_pinned: false,
      created_at: new Date().toISOString(),
      seen_by: [],
    };

    const image = pendingImage;
    setMessages((current) => mergeMessages(current, [optimistic]));
    setInput("");
    setReplyTo(null);
    setPendingImage(null);
    setSending(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined
    );

    try {
      let fileUrl: string | null = null;
      if (image) {
        const uploaded = await uploadFile({
          uri: image.uri,
          name: image.fileName ?? `chat-${Date.now()}.jpg`,
          type: image.mimeType ?? "image/jpeg",
          size: image.fileSize,
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

      setMessages((current) =>
        mergeMessages(
          current.filter((message) => message.id !== tempId),
          [created]
        )
      );
      void queryClient.invalidateQueries({ queryKey: qk.chatOverview });
      void queryClient.invalidateQueries({ queryKey: qk.recentComments });
      void queryClient.invalidateQueries({ queryKey: qk.unread });
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== tempId));
      setInput(text);
      if (image) setPendingImage(image);
      const message =
        error instanceof ApiError ? error.message : "پیام ارسال نشد. دوباره تلاش کن.";
      Alert.alert("ارسال نشد", message);
    } finally {
      pendingSends.current.delete(tempId);
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

  const startEdit = (message: Message) => {
    setMenuAnchor(null);
    setEditTarget(message);
    setEditText(message.content);
  };

  const startReply = (message: Message) => {
    setReplyTo(message);
    setMenuAnchor(null);
    // Let the reply bar mount before pulling up the keyboard.
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const copyMessage = async (message: Message) => {
    const text = message.content.trim();
    setMenuAnchor(null);
    if (!text) {
      Alert.alert("کپی", "این پیام متنی ندارد.");
      return;
    }
    try {
      await Clipboard.setStringAsync(text);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
    } catch {
      Alert.alert("کپی", "کپی متن ممکن نشد.");
    }
  };

  const forwardMessage = async (message: Message, target: "global" | number) => {
    if (forwarding) return;
    setForwarding(true);
    try {
      await sendMessage({
        content: message.content,
        file_url: message.file_url,
        receiver_id: typeof target === "number" ? target : null,
        assignment_id: null,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
      setForwardFor(null);
      void queryClient.invalidateQueries({ queryKey: qk.chatOverview });
    } catch (error) {
      Alert.alert(
        "ارسال نشد",
        error instanceof ApiError ? error.message : "هدایت پیام انجام نشد."
      );
    } finally {
      setForwarding(false);
    }
  };

  const saveEdit = async () => {
    if (!editTarget || editSaving) return;
    const content = editText.trim();
    if (!content && !editTarget.file_url) {
      Alert.alert("پیام خالی است", "متن پیام را وارد کن.");
      return;
    }
    setEditSaving(true);
    try {
      const updated = await editMessage(editTarget.id, content);
      setMessages((current) =>
        current.map((message) => (message.id === updated.id ? updated : message))
      );
      setEditTarget(null);
      setEditText("");
      void queryClient.invalidateQueries({ queryKey: qk.chatOverview });
    } catch (error) {
      Alert.alert(
        "خطا",
        error instanceof ApiError ? error.message : "ویرایش انجام نشد."
      );
    } finally {
      setEditSaving(false);
    }
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
              setMenuAnchor(null);
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
      setMenuAnchor(null);
    } catch (error) {
      Alert.alert(
        "خطا",
        error instanceof ApiError ? error.message : "پین کردن انجام نشد."
      );
    }
  };

  const canSend = Boolean(input.trim() || pendingImage) && !sending;
  const data = useMemo(() => [...messages].reverse(), [messages]);

  /* ---- inline long-press menu (Telegram's small anchored card) ---- */
  const MENU_WIDTH = 190;
  const MENU_ROW = 42;
  const anchorMessage = menuAnchor?.message ?? null;
  const menuActions: {
    key: string;
    icon: ComponentProps<typeof Ionicons>["name"];
    label: string;
    tone?: string;
    run: () => void;
  }[] = [];
  if (anchorMessage) {
    menuActions.push({
      key: "reply",
      icon: "arrow-undo-outline",
      label: "پاسخ",
      run: () => startReply(anchorMessage),
    });
    if (anchorMessage.content.trim()) {
      menuActions.push({
        key: "copy",
        icon: "copy-outline",
        label: "کپی متن",
        run: () => void copyMessage(anchorMessage),
      });
    }
    menuActions.push({
      key: "forward",
      icon: "arrow-redo-outline",
      label: "هدایت به…",
      run: () => {
        setMenuAnchor(null);
        setForwardFor(anchorMessage);
      },
    });
    if (canDelete) {
      menuActions.push({
        key: "pin",
        icon: anchorMessage.is_pinned ? "pin-outline" : "pin",
        label: anchorMessage.is_pinned ? "برداشتن پین" : "پین",
        run: () => void togglePin(anchorMessage),
      });
    }
    if (anchorMessage.sender_id === user?.id) {
      menuActions.push({
        key: "edit",
        icon: "pencil-outline",
        label: "ویرایش",
        run: () => startEdit(anchorMessage),
      });
    }
    if (canDelete || anchorMessage.sender_id === user?.id) {
      menuActions.push({
        key: "delete",
        icon: "trash-outline",
        label: "حذف",
        tone: colors.red,
        run: () => {
          setMenuAnchor(null);
          confirmDelete(anchorMessage);
        },
      });
    }
  }
  const menuHeight = menuActions.length * MENU_ROW + 12;
  const menuTop = menuAnchor
    ? Math.max(
        insets.top + 12,
        Math.min(
          menuAnchor.y + menuHeight + 28 > window.height - insets.bottom
            ? menuAnchor.y - menuHeight - 12
            : menuAnchor.y + 12,
          window.height - insets.bottom - menuHeight - 12
        )
      )
    : 0;
  const menuLeft = menuAnchor
    ? Math.min(
        Math.max(12, menuAnchor.x - MENU_WIDTH / 2),
        window.width - MENU_WIDTH - 12
      )
    : 0;

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
        onLongPress={(point) => setMenuAnchor({ message: item, ...point })}
        onImagePress={setViewerUrl}
        onReply={() => startReply(item)}
        onProfile={setProfileId}
        onSeenInfo={setInfoMessage}
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
        behavior="padding"
        keyboardVerticalOffset={0}
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
              ref={inputRef}
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
              color={canSend ? colors.onAccent : colors.faint}
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

      {/* Long-press menu — small card anchored to the bubble, above or below. */}
      <Modal
        visible={menuAnchor !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMenuAnchor(null)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setMenuAnchor(null)}
        >
          <Animated2.View
            entering={FadeIn.duration(SEND_FADE_MS)}
            style={[
              styles.contextMenu,
              { width: MENU_WIDTH, top: menuTop, left: menuLeft },
            ]}
          >
            {menuActions.map((action, index) => (
              <Pressable
                key={action.key}
                onPress={action.run}
                style={({ pressed }) => [
                  styles.contextRow,
                  { height: MENU_ROW },
                  index > 0 && styles.contextRowBorder,
                  pressed && styles.contextRowPressed,
                ]}
              >
                <Ionicons
                  name={action.icon}
                  size={16}
                  color={action.tone ?? colors.textSoft}
                />
                <AppText
                  color={action.tone ?? colors.text}
                  style={styles.contextLabel}
                >
                  {action.label}
                </AppText>
              </Pressable>
            ))}
          </Animated2.View>
        </Pressable>
      </Modal>

      {/* Message info — who has seen it and when (from the double tick). */}
      <Sheet
        visible={infoMessage !== null}
        onClose={() => setInfoMessage(null)}
        title="مشاهده پیام"
        subtitle={
          infoMessage?.seen_by?.length
            ? `${infoMessage.seen_by.length} نفر دیده‌اند`
            : "هنوز کسی ندیده"
        }
      >
        {infoMessage?.content.trim() ? (
          <View style={styles.actionPreview}>
            <AppText variant="body" color={colors.textSoft} numberOfLines={3}>
              {infoMessage.content}
            </AppText>
          </View>
        ) : null}

        {(infoMessage?.seen_by ?? []).length === 0 ? (
          <View style={styles.infoEmpty}>
            <Ionicons name="checkmark" size={16} color={colors.faint} />
            <AppText variant="caption" color={colors.faint} style={{ flex: 1 }}>
              پیام ارسال شده اما هنوز کسی آن را باز نکرده است.
            </AppText>
          </View>
        ) : (
          (infoMessage?.seen_by ?? []).map((receipt, index) => (
            <View
              key={`${receipt.username ?? "user"}-${receipt.read_at}-${index}`}
              style={styles.menuRow}
            >
              <Avatar name={receipt.username} size="xs" />
              <View style={{ flex: 1, gap: 1 }}>
                <AppText
                  variant="label"
                  ltr
                  numberOfLines={1}
                  style={{ fontFamily: fonts.semibold }}
                >
                  {receipt.username ?? "کاربر"}
                </AppText>
                <AppText variant="caption" color={colors.faint} ltr style={{ fontSize: 10.5 }}>
                  {faDate(receipt.read_at, "weekdayTime")}
                </AppText>
              </View>
              <Ionicons name="checkmark-done" size={15} color={colors.accent} />
            </View>
          ))
        )}
      </Sheet>

      {/* Forward — pick the class room or one teammate. */}
      <Sheet
        visible={forwardFor !== null}
        onClose={() => setForwardFor(null)}
        title="هدایت پیام"
        subtitle="به کدام گفتگو؟"
      >
        {forwardFor ? (
          <>
            <View style={styles.actionPreview}>
              <AppText variant="body" color={colors.textSoft} numberOfLines={3}>
                {forwardFor.content.trim() || "📷 تصویر"}
              </AppText>
            </View>

            <Pressable
              onPress={() => void forwardMessage(forwardFor, "global")}
              style={styles.menuRow}
              disabled={forwarding}
            >
              <View style={styles.menuIcon}>
                <Ionicons name="people-outline" size={17} color={colors.accent} />
              </View>
              <AppText variant="label" style={{ flex: 1 }}>
                گفتگوی کلاس
              </AppText>
            </Pressable>

            {(team.data ?? [])
              .filter((person) => person.id !== user?.id)
              .map((person) => (
                <Pressable
                  key={person.id}
                  onPress={() => void forwardMessage(forwardFor, person.id)}
                  style={styles.menuRow}
                  disabled={forwarding}
                >
                  <Avatar name={person.username} uri={person.avatar_url} size="xs" />
                  <AppText
                    variant="label"
                    ltr
                    style={{ flex: 1, fontFamily: fonts.semibold }}
                    numberOfLines={1}
                  >
                    {person.username}
                  </AppText>
                  <Ionicons name="arrow-redo-outline" size={15} color={colors.faint} />
                </Pressable>
              ))}
          </>
        ) : null}
      </Sheet>

      <UserProfileModal userId={profileId} onClose={() => setProfileId(null)} />

      <Sheet
        visible={editTarget !== null}
        onClose={() => {
          if (!editSaving) setEditTarget(null);
        }}
        title="ویرایش پیام"
        subtitle="فقط متن پیام تغییر می‌کند"
        footer={
          <View style={styles.editActions}>
            <Pressable
              onPress={() => {
                if (!editSaving) setEditTarget(null);
              }}
              style={[styles.editButton, styles.editCancel]}
              disabled={editSaving}
            >
              <AppText variant="label" color={colors.muted}>
                انصراف
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => void saveEdit()}
              style={[styles.editButton, styles.editSave, editSaving && { opacity: 0.6 }]}
              disabled={editSaving}
            >
              <AppText variant="label" color={colors.black} style={{ fontFamily: fonts.bold }}>
                {editSaving ? "در حال ذخیره…" : "ذخیره"}
              </AppText>
            </Pressable>
          </View>
        }
      >
        <View style={styles.editInputWrap}>
          <TextInput
            value={editText}
            onChangeText={setEditText}
            placeholder="متن پیام…"
            placeholderTextColor={colors.faint}
            multiline
            autoFocus
            maxLength={5000}
            selectionColor={colors.amber}
            style={styles.editInput}
            textAlignVertical="top"
          />
        </View>
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
  messageWrap: { width: "100%", alignItems: "stretch" },
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
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginVertical: 1.5,
  },
  // Telegram RTL layout: my messages hug the right edge, everyone else's the
  // left — with the avatar sitting at the far left, immediately beside the
  // bubble (same as the web client).
  ownRow: { justifyContent: "flex-end" },
  otherRow: { justifyContent: "flex-start" },
  swipeHint: {
    position: "absolute",
    top: "50%",
    marginTop: -13,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(43,82,120,0.35)",
    borderWidth: 1,
    borderColor: "rgba(108,178,234,0.35)",
  },
  swipeHintLeft: { left: 2 },
  swipeHintRight: { right: 2 },
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
    backgroundColor: "#2b5278",
    borderColor: "rgba(255,255,255,0.08)",
    borderBottomRightRadius: 6,
  },
  otherBubble: {
    backgroundColor: "#182533",
    borderColor: "rgba(255,255,255,0.06)",
    borderBottomLeftRadius: 6,
  },
  messageText: { fontSize: 14.5, lineHeight: 23 },
  messageMeta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 4,
  },
  tickButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 1,
  },
  /* ---- inline long-press menu ---- */
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  contextMenu: {
    position: "absolute",
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: "rgba(20,20,24,0.98)",
    overflow: "hidden",
  },
  contextRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  contextRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.07)",
  },
  contextRowPressed: {
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  contextLabel: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },
  infoEmpty: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
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
    backgroundColor: "#4fa3e3",
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
    backgroundColor: "rgba(14,14,17,0.94)",
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
    backgroundColor: "rgba(0,0,0,0.92)",
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
    backgroundColor: "rgba(255,255,255,0.04)",
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
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  editInputWrap: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  editInput: {
    minHeight: 104,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 23,
    textAlign: "right",
    writingDirection: "rtl",
  },
  editActions: {
    flexDirection: "row-reverse",
    gap: spacing.sm,
  },
  editButton: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  editCancel: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  editSave: {
    backgroundColor: colors.amber,
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
