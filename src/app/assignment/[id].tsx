import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  addAttachment,
  ApiError,
  deleteAssignment,
  deleteAttachment,
  deleteMessage,
  fetchAssignment,
  fetchAssignmentTeam,
  fetchAttachments,
  fetchMessages,
  markMessageRead,
  markRoomRead,
  qk,
  readRoomBatch,
  resolveMediaUrl,
  sendMessage,
  toggleAssignment,
  uploadFile,
} from "@/api/client";
import type { Assignment, Attachment, Message, TeamMember } from "@/api/types";
import { Button } from "@/components/Button";
import {
  EmptyState,
  GlassCard,
  SectionTitle,
  SkeletonRows,
  SolidCard,
} from "@/components/cards";
import { Header } from "@/components/Header";
import { ImageViewer, type ViewerImage } from "@/components/ImageViewer";
import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { AppText, Avatar, Pill } from "@/components/ui";
import { UserProfileModal } from "@/components/UserProfileModal";
import { useRoomSocket, type RoomSocketEvent } from "@/hooks/useRoomSocket";
import { useBellSchedule } from "@/hooks/useBellSchedule";
import { useNow } from "@/hooks/useNow";
import { countdownTone, dueCountdown } from "@/lib/bell";
import { faDate, formatDue, fmtNum, fmtPercent } from "@/lib/format";
import { isStaff } from "@/lib/roles";
import { categoryItemLabel, subjectName, SUBJECT_BY_ID } from "@/lib/subjects";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, screenGutter, spacing } from "@/theme/tokens";

const IMAGE_FILE_RE = /\.(png|jpe?g|webp|gif|heic|heif)(\?|$)/i;

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const map = new Map<number, Message>();
  for (const message of current) map.set(message.id, message);
  for (const message of incoming) map.set(message.id, message);
  return [...map.values()].sort((a, b) => {
    const byDate = a.created_at.localeCompare(b.created_at);
    return byDate !== 0 ? byDate : a.id - b.id;
  });
}

/** Web `InfoChip`: icon + tiny label over a bold value (2-per-row grid). */
function InfoChip({
  icon,
  label,
  value,
  sub,
  tone = colors.text,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <View style={styles.infoChip}>
      <View style={styles.infoChipHead}>
        <Ionicons name={icon} size={13} color={colors.faint} />
        <AppText color={colors.faint} style={styles.infoChipLabel}>
          {label}
        </AppText>
      </View>
      <AppText color={tone} style={styles.infoChipValue} numberOfLines={1}>
        {value}
      </AppText>
      {sub ? (
        <AppText color={colors.faint} style={styles.infoChipSub} numberOfLines={1}>
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}

/** Web `وضعیت تیم`: a wrap of avatars with a green check / grey cross badge. */
function TeamGrid({
  team,
  onProfile,
}: {
  team: TeamMember[];
  onProfile: (userId: number) => void;
}) {
  return (
    <View style={styles.teamGrid}>
      {team.map((member) => (
        <Pressable
          key={member.user.id}
          onPress={() => onProfile(member.user.id)}
          style={styles.teamCell}
          accessibilityLabel={`${member.user.username} — ${
            member.completed ? "انجام شده" : "انجام نشده"
          }`}
        >
          <View style={styles.teamAvatarWrap}>
            <Avatar name={member.user.username} uri={member.user.avatar_url} size="md" />
            <View
              style={[
                styles.teamBadge,
                {
                  backgroundColor: member.completed ? colors.success : colors.panelDeep,
                  borderColor: colors.black,
                },
              ]}
            >
              <Ionicons
                name={member.completed ? "checkmark" : "close"}
                size={11}
                color={member.completed ? colors.black : colors.faint}
              />
            </View>
            {member.is_self ? <View style={styles.teamSelfDot} /> : null}
          </View>
          <AppText
            ltr
            align="center"
            color={colors.textSoft}
            style={styles.teamName}
            numberOfLines={1}
          >
            {member.user.username}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

function AttachmentTile({
  attachment,
  onImage,
  onDelete,
}: {
  attachment: Attachment;
  onImage: (url: string) => void;
  onDelete?: () => void;
}) {
  const isImage = IMAGE_FILE_RE.test(attachment.file_url);
  const url = resolveMediaUrl(attachment.file_url);

  if (isImage) {
    return (
      <Pressable onPress={() => onImage(url)} style={styles.attachmentImageWrap}>
        <Image
          source={{ uri: url }}
          style={styles.attachmentImage}
          contentFit="cover"
          transition={140}
          cachePolicy="memory-disk"
        />
        {onDelete ? (
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            style={styles.attachmentDelete}
            accessibilityLabel="حذف پیوست"
          >
            <Ionicons name="trash-outline" size={13} color={colors.white} />
          </Pressable>
        ) : null}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => {
        void Linking.openURL(url).catch(() =>
          Alert.alert("پیوست", "باز کردن فایل ممکن نشد.")
        );
      }}
      style={styles.attachmentFile}
    >
      <View style={styles.fileIcon}>
        <Ionicons name="document-text-outline" size={18} color={colors.amber} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <AppText variant="caption" numberOfLines={1} style={{ fontFamily: fonts.medium }}>
          {attachment.file_name}
        </AppText>
        <AppText variant="caption" color={colors.faint} numberOfLines={1}>
          {attachment.user_username ?? "پیوست"}
        </AppText>
      </View>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel="حذف پیوست">
          <Ionicons name="trash-outline" size={15} color={colors.red} />
        </Pressable>
      ) : (
        <Ionicons name="download-outline" size={16} color={colors.muted} />
      )}
    </Pressable>
  );
}

export default function AssignmentDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : (params.id ?? "");
  const id = Number(rawId);
  const validId = Number.isFinite(id) && id > 0;

  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const now = useNow();
  const { bells } = useBellSchedule();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [comments, setComments] = useState<Message[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentImage, setCommentImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [sendingComment, setSendingComment] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [deletingAttachment, setDeletingAttachment] = useState<number | null>(null);

  const assignmentQuery = useQuery({
    queryKey: qk.assignment(id),
    queryFn: () => fetchAssignment(id),
    enabled: validId,
  });

  const teamQuery = useQuery({
    queryKey: qk.assignmentTeam(id),
    queryFn: () => fetchAssignmentTeam(id),
    enabled: validId,
  });

  const attachmentsQuery = useQuery({
    queryKey: qk.attachments(id),
    queryFn: () => fetchAttachments(id),
    enabled: validId,
  });

  const commentsQuery = useQuery({
    queryKey: qk.messages(`assignment-${id}`),
    queryFn: () => fetchMessages({ scope: "assignment", assignmentId: id, limit: 120 }),
    enabled: validId,
  });

  useEffect(() => {
    setComments([]);
    setCommentInput("");
    setCommentImage(null);
  }, [id]);

  useEffect(() => {
    if (commentsQuery.data) {
      setComments((current) => mergeMessages(current, commentsQuery.data));
    }
  }, [commentsQuery.data]);

  const room = validId ? `assignment:${id}` : null;

  const markRead = () => {
    if (!validId) return;
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      markRoomRead(`assignment:${id}`)
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
  }, [id, comments.length]);

  // One receipt per unseen comment, so the sender's tick turns double live.
  useEffect(() => {
    if (!validId) return;
    const timer = setTimeout(() => {
      readRoomBatch(`assignment:${id}`)
        .then(() => queryClient.invalidateQueries({ queryKey: qk.unread }))
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [id, queryClient, validId]);

  const onSocketEvent = (event: RoomSocketEvent) => {
    if (event.type === "delete") {
      setComments((current) => current.filter((message) => message.id !== event.id));
    } else if (event.type === "clear") {
      setComments([]);
    } else if (event.type === "edit") {
      setComments((current) =>
        current.map((message) =>
          message.id === event.message.id ? event.message : message
        )
      );
    } else if (event.type === "read") {
      if (event.readerId === user?.id) return;
      const ids = new Set(event.messageIds);
      const receipt = { username: event.readerUsername, read_at: event.readAt };
      setComments((current) =>
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

  const { connected } = useRoomSocket(room, {
    onMessage: (message) => {
      setComments((current) => mergeMessages(current, [message]));
      if (message.sender_id !== user?.id) {
        void markMessageRead(message.id)
          .then(() => markRoomRead(`assignment:${id}`))
          .catch(() => undefined);
      }
    },
    onEvent: onSocketEvent,
  });

  const toggle = useMutation({
    mutationFn: () => toggleAssignment(id),
    onSuccess: (updated: Assignment) => {
      queryClient.setQueryData(qk.assignment(id), updated);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
      void queryClient.invalidateQueries({ queryKey: qk.assignments });
      void queryClient.invalidateQueries({ queryKey: qk.assignmentTeam(id) });
      void queryClient.invalidateQueries({ queryKey: qk.overview });
      void queryClient.invalidateQueries({ queryKey: qk.leaderboard });
      void queryClient.invalidateQueries({ queryKey: qk.userStats(user?.id ?? 0) });
    },
    onError: (error) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined
      );
      Alert.alert(
        error instanceof ApiError && error.status === 429 ? "محدودیت ضدتقلب" : "خطا",
        error instanceof ApiError ? error.message : "تغییر وضعیت انجام نشد."
      );
    },
  });

  const removeAssignment = () => {
    Alert.alert("حذف تکلیف", "این تکلیف برای همه حذف می‌شود. مطمئنی؟", [
      { text: "انصراف", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteAssignment(id);
              await queryClient.invalidateQueries({ queryKey: qk.assignments });
              void queryClient.invalidateQueries({ queryKey: qk.overview });
              void queryClient.invalidateQueries({ queryKey: qk.leaderboard });
              void queryClient.invalidateQueries({ queryKey: qk.userStats(user?.id ?? 0) });
              void queryClient.invalidateQueries({ queryKey: qk.recentComments });
              router.back();
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

  const pickCommentImage = async () => {
    if (sendingComment) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setCommentImage(result.assets[0]);
      }
    } catch {
      Alert.alert("تصویر", "انتخاب تصویر ممکن نشد.");
    }
  };

  const uploadAttachmentFile = async () => {
    if (uploadingAttachment) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setUploadingAttachment(true);
      await addAttachment(id, {
        uri: asset.uri,
        name: asset.fileName ?? `attachment-${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
        size: asset.fileSize,
      });
      await queryClient.invalidateQueries({ queryKey: qk.attachments(id) });
      // Every uploaded file adds +5% to this user's server-side percentage.
      void queryClient.invalidateQueries({ queryKey: qk.userStats(user?.id ?? 0) });
      void queryClient.invalidateQueries({ queryKey: qk.leaderboard });
      void queryClient.invalidateQueries({ queryKey: qk.overview });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
    } catch (error) {
      Alert.alert(
        "پیوست",
        error instanceof ApiError ? error.message : "آپلود فایل انجام نشد."
      );
    } finally {
      setUploadingAttachment(false);
    }
  };

  const removeAttachmentFile = (attachment: Attachment) => {
    Alert.alert("حذف پیوست", "این فایل برای همه حذف می‌شود؟", [
      { text: "انصراف", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setDeletingAttachment(attachment.id);
            try {
              await deleteAttachment(attachment.id);
              await queryClient.invalidateQueries({ queryKey: qk.attachments(id) });
              void queryClient.invalidateQueries({ queryKey: qk.userStats(user?.id ?? 0) });
              void queryClient.invalidateQueries({ queryKey: qk.leaderboard });
              void queryClient.invalidateQueries({ queryKey: qk.overview });
            } catch (error) {
              Alert.alert(
                "خطا",
                error instanceof ApiError ? error.message : "حذف پیوست انجام نشد."
              );
            } finally {
              setDeletingAttachment(null);
            }
          })();
        },
      },
    ]);
  };

  const sendComment = async () => {
    if (sendingComment) return;
    const text = commentInput.trim();
    if (!text && !commentImage) return;
    setSendingComment(true);
    try {
      let fileUrl: string | null = null;
      if (commentImage) {
        const uploaded = await uploadFile({
          uri: commentImage.uri,
          name: commentImage.fileName ?? `comment-${Date.now()}.jpg`,
          type: commentImage.mimeType ?? "image/jpeg",
          size: commentImage.fileSize,
        });
        fileUrl = uploaded.url;
      }
      const created = await sendMessage({
        content: text,
        assignment_id: id,
        file_url: fileUrl,
      });
      setComments((current) => mergeMessages(current, [created]));
      setCommentInput("");
      setCommentImage(null);
      void queryClient.invalidateQueries({ queryKey: qk.recentComments });
      void queryClient.invalidateQueries({ queryKey: qk.unread });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    } catch (error) {
      Alert.alert(
        "ارسال نشد",
        error instanceof ApiError ? error.message : "کامنت ارسال نشد."
      );
    } finally {
      setSendingComment(false);
    }
  };

  const removeComment = (message: Message) => {
    Alert.alert("حذف کامنت", "این کامنت برای همه حذف می‌شود؟", [
      { text: "انصراف", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteMessage(message.id);
              setComments((current) => current.filter((item) => item.id !== message.id));
              void queryClient.invalidateQueries({ queryKey: qk.recentComments });
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

  const assignment = assignmentQuery.data;
  const team = teamQuery.data ?? [];
  const completedCount = team.filter((member) => member.completed).length;
  const teamPercent = team.length ? (completedCount / team.length) * 100 : 0;
  const isDone = assignment?.is_completed_by_me ?? false;
  const staff = isStaff(user);
  const canSend = Boolean(commentInput.trim() || commentImage) && !sendingComment;

  const dueCountdownValue = dueCountdown(
    assignment?.due_date ?? null,
    now,
    bells,
    assignment?.subject_id
  );
  const dueToneValue = countdownTone(dueCountdownValue);
  const dueColorValue =
    dueToneValue === "red"
      ? colors.red
      : dueToneValue === "yellow"
        ? colors.warning
        : colors.muted;

  // گالری تصاویر همین تکلیف: پیوست‌ها اول، بعد تصاویر کامنت‌ها.
  const viewerImages: ViewerImage[] = [
    ...(attachmentsQuery.data ?? [])
      .filter((attachment) => IMAGE_FILE_RE.test(attachment.file_url))
      .map((attachment) => ({
        src: resolveMediaUrl(attachment.file_url),
        alt: attachment.file_name || "پیوست تکلیف",
      })),
    ...comments
      .filter((message) => message.file_url && IMAGE_FILE_RE.test(message.file_url))
      .map((message) => ({
        src: resolveMediaUrl(message.file_url as string),
        alt: message.sender_username ?? "تصویر کامنت",
      })),
  ];

  const openViewer = (url: string) => {
    const found = viewerImages.findIndex((entry) => entry.src === url);
    setViewerIndex(found >= 0 ? found : 0);
  };

  if (!validId) {
    return (
      <Screen edges={["top", "bottom"]}>
        <Header title="تکلیف" onBack={() => router.back()} />
        <EmptyState icon="alert-circle-outline" title="شناسهٔ تکلیف نامعتبر است" />
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]}>
      <Header
        title="جزئیات تکلیف"
        subtitle={assignment?.course || "تکلیف کلاس"}
        onBack={() => router.back()}
        actions={
          staff ? (
            <Pressable
              onPress={() => setMenuOpen(true)}
              style={styles.headerAction}
              hitSlop={8}
              accessibilityLabel="مدیریت تکلیف"
            >
              <Ionicons name="ellipsis-horizontal" size={19} color={colors.text} />
            </Pressable>
          ) : null
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {assignmentQuery.isLoading ? (
            <SkeletonRows count={3} height={110} />
          ) : assignmentQuery.isError || !assignment ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="تکلیف باز نشد"
              hint={
                assignmentQuery.error instanceof ApiError
                  ? assignmentQuery.error.message
                  : "اتصال اینترنت را بررسی کنید."
              }
              actionLabel="تلاش دوباره"
              onAction={() => void assignmentQuery.refetch()}
            />
          ) : (
            <>
              <Animated.View entering={FadeInDown.duration(180)}>
                <GlassCard glow={dueToneValue === "red" && !isDone} contentStyle={styles.hero}>
                  <View style={styles.heroTop}>
                    <View
                      style={[
                        styles.statusCircle,
                        {
                          backgroundColor: isDone ? colors.tealSoft : colors.amberSoft,
                          borderColor: isDone
                            ? "rgba(79,209,181,0.4)"
                            : colors.amberLine,
                        },
                      ]}
                    >
                      <Ionicons
                        name={isDone ? "checkmark" : "hourglass-outline"}
                        size={18}
                        color={isDone ? colors.teal : colors.amber}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <AppText variant="title" style={{ fontSize: 21 }}>
                        {assignment.title}
                      </AppText>
                      <View style={styles.heroMeta}>
                        {assignment.course ? (
                          <Pill label={assignment.course} tone="blue" />
                        ) : null}
                        {assignment.subtype ? (
                          <Pill label={categoryItemLabel(assignment.subtype)} tone="muted" />
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {assignment.description ? (
                    <AppText variant="body" color={colors.textSoft} style={styles.description}>
                      {assignment.description}
                    </AppText>
                  ) : (
                    <AppText variant="caption" color={colors.faint}>
                      توضیحی برای این تکلیف ثبت نشده.
                    </AppText>
                  )}

                  <View style={styles.infoGrid}>
                    <InfoChip
                      icon="book-outline"
                      label="درس"
                      value={subjectName(assignment.subject_id, assignment.course) || "—"}
                      sub={SUBJECT_BY_ID[assignment.subject_id]?.teacher}
                    />
                    <InfoChip
                      icon="calendar-outline"
                      label="مهلت"
                      value={formatDue(assignment.due_date)}
                      sub={dueCountdownValue?.label ?? "بدون مهلت"}
                      tone={dueColorValue}
                    />
                    <InfoChip
                      icon="person-outline"
                      label="سازنده"
                      value={assignment.creator_username || "نامشخص"}
                    />
                    <InfoChip
                      icon="time-outline"
                      label="وضعیت من"
                      value={
                        isDone
                          ? assignment.category === "exam"
                            ? "خوندم"
                            : "انجام دادم"
                          : "در انتظار انجام"
                      }
                      tone={isDone ? colors.success : colors.text}
                    />
                  </View>

                  <View style={styles.dueBox}>
                    <View style={styles.dueRow}>
                      <Ionicons
                        name={isDone ? "checkmark-done-outline" : "time-outline"}
                        size={15}
                        color={isDone ? colors.teal : dueColorValue}
                      />
                      <AppText variant="caption" color={colors.muted} style={{ flex: 1 }}>
                        {isDone
                          ? "این تکلیف توسط تو تحویل شده است."
                          : dueCountdownValue?.label ?? "بدون مهلت"}
                      </AppText>
                      <AppText variant="caption" color={colors.faint}>
                        {formatDue(assignment.due_date)}
                      </AppText>
                    </View>
                    {assignment.due_date ? (
                      <ProgressBar
                        value={Math.max(
                          0,
                          Math.min(
                            100,
                            100 -
                              (Math.max(
                                0,
                                (dueCountdownValue?.alignedDueMs ?? now) - now
                              ) /
                                3600000) /
                                72 *
                                100
                          )
                        )}
                        color={dueColorValue}
                        height={4}
                      />
                    ) : null}
                  </View>

                  <View style={styles.progressBlock}>
                    <View style={styles.progressHead}>
                      <AppText variant="caption" color={colors.muted}>
                        پیشرفت تیم
                      </AppText>
                      <AppText variant="caption" color={colors.text} ltr style={{ fontFamily: fonts.semibold }}>
                        {fmtNum(completedCount)} / {fmtNum(team.length)} · {fmtPercent(teamPercent)}
                      </AppText>
                    </View>
                    <ProgressBar value={teamPercent} height={6} />
                  </View>

                  <Button
                    label={isDone ? "برگشت به انجام‌نشده" : "انجام دادم"}
                    icon={isDone ? "arrow-undo-outline" : "checkmark-circle-outline"}
                    variant={isDone ? "ghost" : "primary"}
                    onPress={() => toggle.mutate()}
                    loading={toggle.isPending}
                  />
                </GlassCard>
              </Animated.View>

              <View style={styles.section}>
                <SectionTitle
                  title="انجام داده‌اند"
                  hint={`${fmtNum(assignment.completed_by_users.length)} نفر`}
                />
                <SolidCard style={{ padding: spacing.md, gap: spacing.sm }}>
                  {assignment.completed_by_users.length === 0 ? (
                    <AppText variant="caption" color={colors.faint}>
                      هنوز کسی این تکلیف را انجام نداده.
                    </AppText>
                  ) : (
                    <View style={styles.completerWrap}>
                      {assignment.completed_by_users.map((completer) => (
                        <Pressable
                          key={completer.id}
                          onPress={() => setProfileId(completer.id)}
                          style={styles.completer}
                          accessibilityLabel={`پروفایل ${completer.username ?? ""}`}
                        >
                          <Avatar name={completer.username} size="xs" />
                          <AppText ltr style={styles.completerName} numberOfLines={1}>
                            {completer.username ?? "کاربر"}
                          </AppText>
                          {completer.id === user?.id ? (
                            <View style={styles.selfTag}>
                              <AppText style={styles.selfTagText}>تو</AppText>
                            </View>
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  )}
                </SolidCard>
              </View>

              <View style={styles.section}>
                <SectionTitle
                  title="وضعیت تیم"
                  hint={`${fmtNum(completedCount)} / ${fmtNum(team.length)}`}
                />
                <SolidCard style={{ padding: spacing.md }}>
                  {teamQuery.isLoading ? (
                    <SkeletonRows count={2} height={44} />
                  ) : team.length === 0 ? (
                    <EmptyState compact icon="people-outline" title="عضوی برای نمایش نیست" />
                  ) : (
                    <TeamGrid team={team} onProfile={setProfileId} />
                  )}
                </SolidCard>
              </View>

              <View style={styles.section}>
                <SectionTitle
                  title="پیوست‌ها"
                  hint={`${fmtNum((attachmentsQuery.data ?? []).length)} فایل`}
                />
                <SolidCard style={{ padding: spacing.md, gap: spacing.sm }}>
                  <Pressable
                    onPress={() => void uploadAttachmentFile()}
                    disabled={uploadingAttachment}
                    style={({ pressed }) => [
                      styles.uploadTile,
                      pressed && styles.uploadTilePressed,
                    ]}
                    accessibilityLabel="افزودن پیوست"
                  >
                    <View style={styles.uploadIcon}>
                      {uploadingAttachment ? (
                        <ActivityIndicator color={colors.text} />
                      ) : (
                        <Ionicons name="cloud-upload-outline" size={18} color={colors.text} />
                      )}
                    </View>
                    <AppText color={colors.text} style={styles.uploadTitle}>
                      {uploadingAttachment ? "در حال آپلود…" : "افزودن تصویر"}
                    </AppText>
                    <AppText color={colors.faint} style={styles.uploadHint}>
                      حداکثر ۲۵ مگابایت
                    </AppText>
                  </Pressable>

                  {attachmentsQuery.isLoading ? (
                    <SkeletonRows count={1} height={54} />
                  ) : (attachmentsQuery.data ?? []).length === 0 ? (
                    <AppText variant="caption" color={colors.faint} align="center">
                      هنوز فایلی پیوست نشده.
                    </AppText>
                  ) : (
                    <View style={styles.attachments}>
                      {(attachmentsQuery.data ?? []).map((attachment) => (
                        <AttachmentTile
                          key={attachment.id}
                          attachment={attachment}
                          onImage={openViewer}
                          onDelete={
                            attachment.user_id === user?.id || staff
                              ? () => removeAttachmentFile(attachment)
                              : undefined
                          }
                        />
                      ))}
                    </View>
                  )}
                  {deletingAttachment !== null ? (
                    <AppText variant="caption" color={colors.faint} align="center">
                      در حال حذف پیوست…
                    </AppText>
                  ) : null}
                </SolidCard>
              </View>

              <View style={styles.section}>
                <SectionTitle
                  title="کامنت‌ها"
                  hint={comments.length ? `${fmtNum(comments.length)} پیام` : "اتاق همین تکلیف"}
                />
                <SolidCard style={{ padding: spacing.md, gap: spacing.sm }}>
                  {commentsQuery.isLoading ? (
                    <SkeletonRows count={2} height={56} />
                  ) : comments.length === 0 ? (
                    <EmptyState
                      compact
                      icon="chatbubble-ellipses-outline"
                      title="هنوز کامنتی نیست"
                      hint="اولین نظر را بنویس؛ همهٔ اعضا می‌توانند کامنت بگذارند."
                    />
                  ) : (
                    comments.map((message) => {
                      const own = message.sender_id === user?.id;
                      const image = message.file_url
                        ? resolveMediaUrl(message.file_url)
                        : null;
                      return (
                        <Pressable
                          key={message.id}
                          onLongPress={() => {
                            if (staff) removeComment(message);
                          }}
                          delayLongPress={350}
                          style={[
                            styles.comment,
                            own && styles.commentOwn,
                          ]}
                        >
                          <View style={styles.commentHead}>
                            <Pressable
                              onPress={() => setProfileId(message.sender_id)}
                              hitSlop={6}
                              accessibilityLabel="پروفایل"
                            >
                              <Avatar
                                name={message.sender_username}
                                uri={message.sender_avatar_url}
                                size="xs"
                              />
                            </Pressable>
                            <AppText
                              variant="caption"
                              color={colors.textSoft}
                              style={{ flex: 1, fontFamily: fonts.medium }}
                              numberOfLines={1}
                              onPress={() => setProfileId(message.sender_id)}
                            >
                              {message.sender_username ?? "همکلاسی"}
                            </AppText>
                            <AppText variant="caption" color={colors.faint} ltr style={{ fontSize: 10 }}>
                              {faDate(message.created_at, "time")}
                            </AppText>
                            {own ? (
                              <Ionicons
                                name={
                                  (message.seen_by?.length ?? 0) > 0
                                    ? "checkmark-done"
                                    : "checkmark"
                                }
                                size={12}
                                color={
                                  (message.seen_by?.length ?? 0) > 0
                                    ? colors.accent
                                    : colors.faint
                                }
                              />
                            ) : null}
                          </View>
                          {image ? (
                            <Pressable onPress={() => openViewer(image)}>
                              <Image
                                source={{ uri: image }}
                                style={styles.commentImage}
                                contentFit="cover"
                                transition={140}
                                cachePolicy="memory-disk"
                              />
                            </Pressable>
                          ) : null}
                          {message.content.trim() ? (
                            <AppText variant="body" style={{ fontSize: 13.5, lineHeight: 22 }}>
                              {message.content}
                            </AppText>
                          ) : null}
                        </Pressable>
                      );
                    })
                  )}

                  {commentImage ? (
                    <View style={styles.pendingComment}>
                      <Image
                        source={{ uri: commentImage.uri }}
                        style={styles.pendingThumb}
                        contentFit="cover"
                      />
                      <AppText variant="caption" color={colors.muted} style={{ flex: 1 }}>
                        تصویر آمادهٔ ارسال است
                      </AppText>
                      <Pressable onPress={() => setCommentImage(null)} hitSlop={8}>
                        <Ionicons name="close" size={16} color={colors.muted} />
                      </Pressable>
                    </View>
                  ) : null}

                  <View style={styles.commentComposer}>
                    <Pressable
                      onPress={() => void pickCommentImage()}
                      style={styles.attach}
                      hitSlop={6}
                    >
                      <Ionicons name="image-outline" size={20} color={colors.amber} />
                    </Pressable>
                    <View style={styles.commentInputWrap}>
                      <TextInput
                        value={commentInput}
                        onChangeText={setCommentInput}
                        placeholder="کامنت روی این تکلیف…"
                        placeholderTextColor={colors.faint}
                        multiline
                        maxLength={2000}
                        selectionColor={colors.amber}
                        style={styles.commentInput}
                        textAlignVertical="center"
                      />
                    </View>
                    <Pressable
                      onPress={() => void sendComment()}
                      disabled={!canSend}
                      style={[
                        styles.send,
                        {
                          backgroundColor: canSend ? colors.amber : "rgba(255,255,255,0.06)",
                        },
                      ]}
                    >
                      <Ionicons
                        name="send"
                        size={17}
                        color={canSend ? colors.onAccent : colors.faint}
                      />
                    </Pressable>
                  </View>

                  <View style={styles.connectionRow}>
                    <View
                      style={[
                        styles.connectionDot,
                        { backgroundColor: connected ? colors.teal : colors.faint },
                      ]}
                    />
                    <AppText variant="caption" color={colors.faint}>
                      {connected ? "اتاق کامنت متصل است" : "در حال اتصال به اتاق کامنت…"}
                    </AppText>
                  </View>
                </SolidCard>
              </View>
            </>
          )}

          <View style={{ height: Math.max(insets.bottom, 20) + 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="مدیریت تکلیف"
        subtitle="فقط ادمین و Owner"
      >
        <Pressable onPress={removeAssignment} style={styles.menuRow}>
          <View style={styles.menuIconDanger}>
            <Ionicons name="trash-outline" size={17} color={colors.red} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <AppText variant="label" color={colors.red} style={{ fontFamily: fonts.semibold }}>
              حذف تکلیف
            </AppText>
            <AppText variant="caption" color={colors.faint}>
              تکلیف و کامنت‌های آن برای همه حذف می‌شود.
            </AppText>
          </View>
        </Pressable>
      </Sheet>

      <ImageViewer
        visible={viewerIndex !== null}
        images={viewerImages}
        index={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />

      <UserProfileModal userId={profileId} onClose={() => setProfileId(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenGutter, paddingTop: spacing.xs },
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
  hero: { padding: spacing.lg, gap: spacing.md },
  heroTop: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  statusCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  heroMeta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
    paddingTop: 2,
  },
  description: { fontSize: 14, lineHeight: 24, color: colors.textSoft },
  dueBox: {
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: "rgba(255,255,255,0.025)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  dueRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
  },
  progressBlock: { gap: 6 },
  progressHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  section: { paddingTop: spacing.xl },
  infoGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
  },
  infoChip: {
    width: "48.5%",
    gap: 2,
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.lineChip,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  infoChipHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
  },
  infoChipLabel: { fontSize: 9.5, lineHeight: 14, letterSpacing: 0.3 },
  infoChipValue: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    lineHeight: 19,
  },
  infoChipSub: { fontSize: 9.5, lineHeight: 14 },
  completerWrap: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 6,
  },
  completer: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingRight: 9,
    paddingLeft: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white03,
  },
  completerName: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
  selfTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.white18,
    backgroundColor: colors.white10,
  },
  selfTagText: {
    fontFamily: fonts.semibold,
    fontSize: 8,
    lineHeight: 12,
    color: colors.text,
  },
  teamGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    columnGap: 12,
    rowGap: 14,
  },
  teamCell: {
    width: 58,
    alignItems: "center",
    gap: 6,
  },
  teamAvatarWrap: { position: "relative" },
  teamBadge: {
    position: "absolute",
    bottom: -4,
    left: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  teamSelfDot: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  teamName: { width: "100%", fontSize: 10, lineHeight: 15 },
  uploadTile: {
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.white12,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  uploadTilePressed: {
    borderColor: colors.white18,
    backgroundColor: colors.white06,
  },
  uploadIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white05,
  },
  uploadTitle: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 18 },
  uploadHint: { fontSize: 10, lineHeight: 15 },
  attachmentDelete: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.62)",
    borderWidth: 1,
    borderColor: colors.white12,
  },
  attachments: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  attachmentImageWrap: {
    width: "48.5%",
    aspectRatio: 1.1,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
  },
  attachmentImage: { width: "100%", height: "100%", backgroundColor: colors.panel },
  attachmentFile: {
    width: "100%",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberLine,
  },
  comment: {
    gap: 5,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.022)",
  },
  commentOwn: {
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  commentHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
  },
  commentImage: {
    width: 190,
    height: 150,
    borderRadius: radius.sm,
    backgroundColor: colors.inkRaised,
  },
  pendingComment: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  pendingThumb: { width: 38, height: 38, borderRadius: radius.xs },
  commentComposer: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    gap: 6,
  },
  attach: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberLine,
  },
  commentInputWrap: {
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: spacing.sm,
  },
  commentInput: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    paddingTop: 8,
    paddingBottom: 8,
    maxHeight: 100,
    textAlign: "right",
    writingDirection: "rtl",
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  connectionRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
  },
  connectionDot: { width: 5, height: 5, borderRadius: 3 },
  menuRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  menuIconDanger: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.redSoft,
    borderWidth: 1,
    borderColor: "rgba(242,104,107,0.3)",
  },
});
