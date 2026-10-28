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
  AppState,
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
  fetchUserProfile,
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
import { GlassSurface, StatusDot } from "@/components/chatkit";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { AppText, Avatar, Divider } from "@/components/ui";
import { ImageViewer, type ViewerImage } from "@/components/ImageViewer";
import { UserProfileModal } from "@/components/UserProfileModal";
import { useRoomSocket, type RoomSocketEvent } from "@/hooks/useRoomSocket";
import { dmRoom, parseRoom } from "@/lib/chat";
import {
  calendarDayDiff,
  faDate,
  fmtNum,
  lastSeenLabel,
  parseDue,
} from "@/lib/format";
import { canChat, isStaff } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

const LOCKED = "برای دسترسی به گفتگو، از ادمین اجازه بگیرید.";
const SEND_FADE_MS = 100;

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
              <Avatar
                name={message.sender_username}
                uri={message.sender_avatar_url}
                size="xs"
                style={{ width: 32, height: 32, borderRadius: 16 }}
              />
            </Pressable>
          ) : (
            <View style={{ width: 38 }} />
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
                    size={12}
                    color={
                      seenCount > 0 ? colors.white : "rgba(255,255,255,0.42)"
                    }
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

/**
 * Glass room header.
 *
 * RTL order (right → left): back, avatar, name + status, menu. The status line
 * is the only truthful presence signal we have for a DM — `lastSeenLabel` reads
 * the backend's two-minute `last_seen` window, refreshed by the 60s profile poll
 * — so the green dot is never a decorative lie.
 */
function RoomHeader({
  kind,
  title,
  peerName,
  peerAvatar,
  peerLastSeen,
  connected,
  memberCount,
  onBack,
  onMenu,
}: {
  kind: "global" | "dm" | "assignment";
  title: string;
  peerName?: string | null;
  peerAvatar?: string | null;
  peerLastSeen?: string | null;
  connected: boolean;
  memberCount: number;
  onBack: () => void;
  onMenu?: () => void;
}) {
  const seen = kind === "dm" ? lastSeenLabel(peerLastSeen) : "";
  const online = kind === "dm" ? seen === "آنلاین" : connected;

  const status =
    kind === "dm"
      ? seen
      : kind === "assignment"
        ? connected
          ? "اتاق کامنت تکلیف · متصل"
          : "اتاق کامنت تکلیف · در حال اتصال…"
        : connected
          ? `${fmtNum(memberCount)} عضو · متصل`
          : `${fmtNum(memberCount)} عضو · در حال اتصال…`;

  return (
    <GlassSurface
      style={styles.roomHeaderGlass}
      contentStyle={styles.roomHeader}
      intensity={30}
    >
      <Pressable
        onPress={onBack}
        hitSlop={10}
        style={styles.headBtn}
        accessibilityRole="button"
        accessibilityLabel="بازگشت"
      >
        <Ionicons name="chevron-forward" size={21} color={colors.white} />
      </Pressable>

      <View style={styles.headAvatar}>
        {kind === "dm" ? (
          <Avatar
            name={peerName}
            uri={peerAvatar}
            size="sm"
            style={{ width: 40, height: 40, borderRadius: 20 }}
          />
        ) : (
          <View style={styles.headGlyph}>
            <Ionicons
              name={kind === "assignment" ? "document-text-outline" : "people"}
              size={18}
              color={colors.white}
            />
          </View>
        )}
      </View>

      <View style={styles.headText}>
        <AppText numberOfLines={1} style={styles.headTitle}>
          {title}
        </AppText>
        <View style={styles.headStatusRow}>
          <StatusDot
            tone={online ? colors.success : "rgba(255,255,255,0.28)"}
            size={6}
          />
          <AppText
            numberOfLines={1}
            color={online ? "rgba(255,255,255,0.62)" : colors.faint}
            style={styles.headStatus}
          >
            {status}
          </AppText>
        </View>
      </View>

      {onMenu ? (
        <Pressable
          onPress={onMenu}
          hitSlop={10}
          style={styles.headBtn}
          accessibilityRole="button"
          accessibilityLabel="مدیریت گفتگو"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.white} />
        </Pressable>
      ) : (
        <View style={styles.headBtn} />
      )}
    </GlassSurface>
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
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const window = useWindowDimensions();
  const pendingSends = useRef(new Set<number>());
  /** Latest messages, readable from the AppState listener without re-binding. */
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

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

  /**
   * DM presence. `/users/team` only carries public fields, so a truthful
   * "آنلاین" comes from the profile endpoint, which exposes `last_seen` (the
   * backend stamps it on every authenticated request and socket open). The
   * existing two-minute window in `lastSeenLabel` is the same rule the web
   * client uses.
   */
  const peerProfile = useQuery({
    queryKey: qk.user(peerId ?? 0),
    queryFn: () => fetchUserProfile(peerId ?? 0),
    enabled: parsed.kind === "dm" && peerId !== undefined && !blocked,
    refetchInterval: 60_000,
    staleTime: 30_000,
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

  /**
   * Coming back from the background does not remount the screen, so the batch
   * read above never re-runs — a DM left open while the phone was locked would
   * keep the other side on a single tick. Re-read on every foreground, capped at
   * the newest message already on screen so nothing newer is marked unseen-ly.
   */
  useEffect(() => {
    if (!room || blocked) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const latest = messagesRef.current[messagesRef.current.length - 1]?.id;
      readRoomBatch(room, latest && latest > 0 ? latest : undefined)
        .then(() => queryClient.invalidateQueries({ queryKey: qk.unread }))
        .catch(() => undefined);
    });
    return () => subscription.remove();
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

  const canDelete = isStaff(user);
  const pinned = messages.find((message) => message.is_pinned);

  const memberCount = team.data?.length ?? 0;
  const infoSeen = infoMessage?.seen_by ?? [];
  /**
   * "Message info" copy. A DM has exactly one possible reader, so naming them
   * beats «1 نفر دیده‌اند» — the brief asks for the recipient's name and the
   * exact time the message was read.
   */
  const infoSubtitle =
    parsed.kind === "dm"
      ? infoSeen.length
        ? `${infoSeen[0].username ?? peer?.username ?? "مخاطب"} · ${faDate(
            infoSeen[0].read_at,
            "weekdayTime"
          )}`
        : `${peer?.username ?? "مخاطب"} هنوز ندیده`
      : infoSeen.length
        ? `${fmtNum(infoSeen.length)} نفر دیده‌اند`
        : "هنوز کسی ندیده";

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

  // گالری همهٔ تصاویر همین گفتگو؛ ترتیب از قدیمی به جدید است.
  const viewerImages = useMemo<ViewerImage[]>(
    () =>
      messages
        .filter((message) => Boolean(message.file_url))
        .map((message) => ({
          src: resolveMediaUrl(message.file_url as string),
          alt: message.sender_username ?? "تصویر گفتگو",
        })),
    [messages]
  );

  const openImage = (url: string) => {
    const found = viewerImages.findIndex((entry) => entry.src === url);
    setViewerIndex(found >= 0 ? found : 0);
  };

  /* ---- inline long-press menu (Telegram's small anchored card) ---- */
  const MENU_WIDTH = 190;
  const MENU_ROW = 44;
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
        onImagePress={openImage}
        onReply={() => startReply(item)}
        onProfile={setProfileId}
        onSeenInfo={setInfoMessage}
      />
    );
  };

  if (blocked) {
    return (
      <Screen edges={["top", "bottom"]}>
        <RoomHeader
          kind={parsed.kind}
          title="گفتگو"
          connected={false}
          memberCount={0}
          onBack={() => router.back()}
        />
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
      <RoomHeader
        kind={parsed.kind}
        title={title}
        peerName={peer?.username}
        peerAvatar={peer?.avatar_url}
        peerLastSeen={peerProfile.data?.last_seen}
        connected={connected}
        memberCount={memberCount}
        onBack={() => router.back()}
        onMenu={canDelete ? () => setMenuOpen(true) : undefined}
      />

      {pinned ? (
        <GlassSurface style={styles.pinnedBar} contentStyle={styles.pinnedInner}>
          <View style={styles.pinnedIcon}>
            <Ionicons name="pin" size={11} color={colors.amber} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <AppText
              color={colors.amber}
              style={{ fontFamily: fonts.medium, fontSize: 9.5, lineHeight: 14 }}
            >
              پیام پین‌شده
            </AppText>
            <AppText
              color="rgba(255,255,255,0.66)"
              numberOfLines={1}
              style={{ fontSize: 11.5, lineHeight: 17, textAlign: "right" }}
            >
              {pinned.content.trim() || "📷 تصویر"}
            </AppText>
          </View>
          <AppText color={colors.faint} style={{ fontSize: 10, lineHeight: 15 }}>
            {pinned.sender_username ?? ""}
          </AppText>
        </GlassSurface>
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
            styles.composerDock,
            { paddingBottom: Math.max(insets.bottom, 10) },
          ]}
        >
          <GlassSurface style={styles.composerGlass} contentStyle={styles.composer}>
            <Pressable
              onPress={() => void pickImage()}
              style={styles.attach}
              hitSlop={6}
              accessibilityLabel="پیوست تصویر"
            >
              <Ionicons name="image-outline" size={20} color={colors.white} />
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
                selectionColor={colors.white}
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
                  backgroundColor: canSend
                    ? colors.white
                    : "rgba(255,255,255,0.06)",
                },
              ]}
              accessibilityLabel="ارسال"
            >
              <Ionicons
                name="arrow-up"
                size={19}
                color={canSend ? colors.black : "rgba(255,255,255,0.32)"}
              />
            </Pressable>
          </GlassSurface>
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
            <GlassSurface
              intensity={48}
              style={{ borderRadius: 18 }}
              contentStyle={styles.contextGlass}
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
                    color={action.tone ?? "rgba(255,255,255,0.78)"}
                  />
                  <AppText
                    color={action.tone ?? colors.white}
                    style={styles.contextLabel}
                  >
                    {action.label}
                  </AppText>
                </Pressable>
              ))}
            </GlassSurface>
          </Animated2.View>
        </Pressable>
      </Modal>

      {/* Message info — who has seen it and when (from the double tick). */}
      <Sheet
        visible={infoMessage !== null}
        onClose={() => setInfoMessage(null)}
        title="مشاهده پیام"
        subtitle={infoSubtitle}
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
              {parsed.kind === "dm"
                ? `«${peer?.username ?? "مخاطب"}» هنوز این پیام را باز نکرده است.`
                : "پیام ارسال شده اما هنوز کسی آن را باز نکرده است."}
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

      <ImageViewer
        visible={viewerIndex !== null}
        images={viewerImages}
        index={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  /* ---- glass room header ---- */
  roomHeaderGlass: {
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(6,6,9,0.78)",
  },
  roomHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 58,
  },
  headBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headAvatar: { width: 40, height: 40 },
  headGlyph: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  headText: { flex: 1, minWidth: 0, gap: 1 },
  headTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 22,
    color: colors.white,
    textAlign: "right",
  },
  headStatusRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
  },
  headStatus: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "right",
  },
  pinnedBar: {
    marginHorizontal: spacing.sm,
    marginTop: 6,
    marginBottom: 2,
    borderRadius: 14,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  pinnedInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pinnedIcon: {
    width: 20,
    height: 20,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
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
    marginVertical: 8,
  },
  messageRow: {
    flexDirection: "row",
    // Avatars sit on the bubble's baseline, like Telegram — not floating at the
    // top of a tall bubble.
    alignItems: "flex-end",
    gap: 7,
    marginVertical: 2,
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
    paddingHorizontal: 11,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    overflow: "hidden",
  },
  ownBubble: {
    backgroundColor: "#2a3a4d",
    borderColor: "rgba(255,255,255,0.10)",
    borderBottomRightRadius: 6,
  },
  otherBubble: {
    backgroundColor: "#15171c",
    borderColor: "rgba(255,255,255,0.07)",
    borderBottomLeftRadius: 6,
  },
  messageText: { fontSize: 14.5, lineHeight: 23 },
  messageMeta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    // Bottom-left of the bubble: the bubble is a column, so `flex-start` is the
    // left edge while the row itself still reads right-to-left.
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 1,
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
    borderRadius: 18,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  contextGlass: {
    paddingVertical: 6,
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
  composerDock: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  composerGlass: {
    borderRadius: 24,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(10,10,13,0.72)",
  },
  composer: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 6,
    minHeight: 54,
  },
  attach: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  inputWrap: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 8,
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
});
