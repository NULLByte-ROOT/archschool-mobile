import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiError,
  deleteAssignment,
  deleteMessage,
  fetchAssignment,
  fetchAssignmentTeam,
  fetchAttachments,
  fetchMessages,
  markRoomRead,
  qk,
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
import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { AppText, Avatar, Divider, Pill } from "@/components/ui";
import { useRoomSocket, type RoomSocketEvent } from "@/hooks/useRoomSocket";
import { useNow } from "@/hooks/useNow";
import {
  dueColor,
  dueTone,
  faDate,
  formatDue,
  fmtNum,
  fmtPercent,
  relativeDue,
} from "@/lib/format";
import { isStaff } from "@/lib/roles";
import { categoryItemLabel } from "@/lib/subjects";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, screenGutter, spacing } from "@/theme/tokens";

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const map = new Map<number, Message>();
  for (const message of current) map.set(message.id, message);
  for (const message of incoming) map.set(message.id, message);
  return [...map.values()].sort((a, b) => {
    const byDate = a.created_at.localeCompare(b.created_at);
    return byDate !== 0 ? byDate : a.id - b.id;
  });
}

function TeamRow({ member }: { member: TeamMember }) {
  return (
    <View style={styles.teamRow}>
      <Avatar name={member.user.username} uri={member.user.avatar_url} size="xs" />
      <AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>
        {member.user.username}
        {member.is_self ? " (تو)" : ""}
      </AppText>
      <View
        style={[
          styles.teamStatus,
          {
            backgroundColor: member.completed ? colors.tealSoft : "rgba(255,255,255,0.04)",
            borderColor: member.completed
              ? "rgba(79,209,181,0.35)"
              : colors.line,
          },
        ]}
      >
        <Ionicons
          name={member.completed ? "checkmark" : "close"}
          size={12}
          color={member.completed ? colors.teal : colors.faint}
        />
      </View>
    </View>
  );
}

function AttachmentTile({
  attachment,
  onImage,
}: {
  attachment: Attachment;
  onImage: (url: string) => void;
}) {
  const isImage = /\.(png|jpe?g|webp|gif|heic|heif)(\?|$)/i.test(attachment.file_url);
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
      <Ionicons name="download-outline" size={16} color={colors.muted} />
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
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [comments, setComments] = useState<Message[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentImage, setCommentImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [sendingComment, setSendingComment] = useState(false);

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

  const onSocketEvent = (event: RoomSocketEvent) => {
    if (event.type === "delete") {
      setComments((current) => current.filter((message) => message.id !== event.id));
    } else if (event.type === "clear") {
      setComments([]);
    }
  };

  const { connected } = useRoomSocket(room, {
    onMessage: (message) =>
      setComments((current) => mergeMessages(current, [message])),
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

  const dueToneValue = assignment ? dueTone(assignment.due_date, now) : "none";

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
              <Animated.View entering={FadeInDown.duration(400)}>
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
                  ) : null}

                  <View style={styles.dueBox}>
                    <View style={styles.dueRow}>
                      <Ionicons
                        name={isDone ? "checkmark-done-outline" : "time-outline"}
                        size={15}
                        color={isDone ? colors.teal : dueColor(dueToneValue)}
                      />
                      <AppText variant="caption" color={colors.muted} style={{ flex: 1 }}>
                        {isDone
                          ? "این تکلیف توسط تو تحویل شده است."
                          : relativeDue(assignment.due_date, now)}
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
                                (new Date(assignment.due_date).getTime() - now) / 3600000
                              ) /
                                72) *
                                100
                          )
                        )}
                        color={dueColor(dueToneValue)}
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
                  title="وضعیت تیم"
                  hint={`${fmtNum(team.length)} عضو`}
                />
                <SolidCard style={{ paddingHorizontal: spacing.md }}>
                  {teamQuery.isLoading ? (
                    <SkeletonRows count={2} height={44} />
                  ) : team.length === 0 ? (
                    <EmptyState compact icon="people-outline" title="عضوی برای نمایش نیست" />
                  ) : (
                    team.map((member, index) => (
                      <View key={member.user.id}>
                        {index > 0 ? <Divider /> : null}
                        <TeamRow member={member} />
                      </View>
                    ))
                  )}
                </SolidCard>
              </View>

              {(attachmentsQuery.data ?? []).length > 0 ? (
                <View style={styles.section}>
                  <SectionTitle
                    title="پیوست‌ها"
                    hint={`${fmtNum((attachmentsQuery.data ?? []).length)} فایل`}
                  />
                  <View style={styles.attachments}>
                    {(attachmentsQuery.data ?? []).map((attachment) => (
                      <AttachmentTile
                        key={attachment.id}
                        attachment={attachment}
                        onImage={setViewerUrl}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

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
                            <Avatar
                              name={message.sender_username}
                              uri={message.sender_avatar_url}
                              size="xs"
                            />
                            <AppText
                              variant="caption"
                              color={own ? colors.amber : colors.textSoft}
                              style={{ flex: 1, fontFamily: fonts.medium }}
                              numberOfLines={1}
                            >
                              {message.sender_username ?? "همکلاسی"}
                            </AppText>
                            <AppText variant="caption" color={colors.faint} ltr style={{ fontSize: 10 }}>
                              {faDate(message.created_at, "time")}
                            </AppText>
                          </View>
                          {image ? (
                            <Pressable onPress={() => setViewerUrl(image)}>
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
                        color={canSend ? "#171004" : colors.faint}
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
  teamRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 8,
  },
  teamStatus: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
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
    borderColor: "rgba(242,180,85,0.26)",
    backgroundColor: "rgba(242,180,85,0.06)",
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
