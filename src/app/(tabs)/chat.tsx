import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import {
  fetchChatOverview,
  fetchRecentComments,
  fetchTeam,
  fetchUnread,
  qk,
} from "@/api/client";
import type { DirectPreview, Message, PublicUser } from "@/api/types";
import { Button } from "@/components/Button";
import {
  EmptyState,
  GlassCard,
  SectionTitle,
  SkeletonRows,
  SolidCard,
} from "@/components/cards";
import { Header } from "@/components/Header";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { AppText, Avatar, Badge, Divider, Pill } from "@/components/ui";
import { UserProfileModal } from "@/components/UserProfileModal";
import { dmRoom } from "@/lib/chat";
import { faDate } from "@/lib/format";
import { canChat, roleColor, roleLabel } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, screenGutter, spacing } from "@/theme/tokens";

const CHAT_LOCK_MESSAGE = "برای دسترسی به گفتگو، از ادمین اجازه بگیرید.";

function LockedChat() {
  const router = useRouter();
  return (
    <View style={styles.lockedWrap}>
      <GlassCard contentStyle={styles.lockedCard}>
        <View style={styles.lockIcon}>
          <Ionicons name="lock-closed" size={26} color={colors.amber} />
        </View>
        <AppText variant="subtitle" align="center">
          گفتگو قفل است
        </AppText>
        <AppText variant="body" color={colors.muted} align="center">
          {CHAT_LOCK_MESSAGE}
        </AppText>
        <View style={styles.lockHint}>
          <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.teal} />
          <AppText variant="caption" color={colors.muted} style={{ flex: 1 }}>
            کامنت گذاشتن روی تکالیف برای همهٔ اعضا آزاد است.
          </AppText>
        </View>
        <Button
          label="دیدن تکالیف"
          icon="checkbox-outline"
          variant="ghost"
          onPress={() => router.push("/assignments")}
        />
      </GlassCard>
    </View>
  );
}

function previewText(message: Message | null): string {
  if (!message) return "هنوز پیامی نیست";
  const body = message.content.trim() || "📷 تصویر";
  return `${message.sender_username ?? "—"}: ${body}`;
}

export default function ChatHubScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [composerOpen, setComposerOpen] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);

  const member = !canChat(user);

  const chats = useQuery({
    queryKey: qk.chatOverview,
    queryFn: fetchChatOverview,
    enabled: !member,
  });
  const team = useQuery({
    queryKey: qk.team,
    queryFn: fetchTeam,
    enabled: !member,
  });
  const recent = useQuery({
    queryKey: qk.recentComments,
    queryFn: () => fetchRecentComments(8),
    enabled: !member,
  });
  const unread = useQuery({
    queryKey: qk.unread,
    queryFn: fetchUnread,
    enabled: !member,
  });

  const unreadMap = new Map(
    (unread.data?.rooms ?? []).map((room) => [room.room, room.unread_count])
  );

  const refreshing =
    chats.isRefetching || recent.isRefetching || unread.isRefetching;

  const refresh = () => {
    void chats.refetch();
    void recent.refetch();
    void unread.refetch();
    void team.refetch();
  };

  const openRoom = (room: string) => {
    setComposerOpen(false);
    router.push({ pathname: "/chat/[room]", params: { room } });
  };

  if (member) {
    return (
      <Screen edges={["top"]}>
        <Header title="گفتگو" subtitle="دسترسی محدود" />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          <LockedChat />
        </ScrollView>
      </Screen>
    );
  }

  const directs = chats.data?.directs ?? [];
  const teamMembers = (team.data ?? []).filter((person) => person.id !== user?.id);

  return (
    <Screen edges={["top"]}>
      <Header
        title="گفتگو"
        subtitle={
          unread.data?.total
            ? `${unread.data.total} پیام خوانده‌نشده`
            : "همه‌چیز خوانده شده"
        }
        actions={
          <Pressable
            onPress={() => setComposerOpen(true)}
            style={styles.composeButton}
            accessibilityLabel="گفتگوی تازه"
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={19} color={colors.amber} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.amber}
            colors={[colors.amber]}
            progressBackgroundColor={colors.panel}
          />
        }
      >
        <Animated.View entering={FadeInDown.duration(180)}>
          <Pressable onPress={() => openRoom("global")}>
            <GlassCard glow contentStyle={styles.globalCard}>
              <View style={styles.globalIcon}>
                <Ionicons name="people" size={22} color={colors.amber} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <View style={styles.rowBetween}>
                  <AppText variant="strong">گفتگوی کلاس</AppText>
                  <View style={styles.rowTight}>
                    {(unreadMap.get("global") ?? 0) > 0 ? (
                      <Badge count={unreadMap.get("global") ?? 0} />
                    ) : null}
                    <Ionicons name="chevron-back" size={15} color={colors.faint} />
                  </View>
                </View>
                <AppText variant="caption" color={colors.muted} numberOfLines={1}>
                  {previewText(chats.data?.global_message ?? null)}
                </AppText>
                <AppText variant="caption" color={colors.faint}>
                  {chats.data?.global_message
                    ? faDate(chats.data.global_message.created_at, "weekdayTime")
                    : "شروع کن"}
                </AppText>
              </View>
            </GlassCard>
          </Pressable>
        </Animated.View>

        <View style={styles.section}>
          <SectionTitle
            title="خصوصی"
            hint={directs.length ? `${directs.length} گفتگو` : undefined}
            actionLabel="گفتگوی تازه"
            onAction={() => setComposerOpen(true)}
          />

          {chats.isLoading ? (
            <SkeletonRows count={2} height={64} />
          ) : directs.length === 0 ? (
            <SolidCard>
              <EmptyState
                compact
                icon="chatbubble-ellipses-outline"
                title="هنوز گفتگوی خصوصی نداری"
                hint="از دکمهٔ بالا یک همکلاسی را انتخاب کن."
                actionLabel="شروع گفتگو"
                onAction={() => setComposerOpen(true)}
              />
            </SolidCard>
          ) : (
            <SolidCard style={{ paddingHorizontal: spacing.md }}>
              {directs.map((direct: DirectPreview, index: number) => {
                const peer = teamMembers.find(
                  (person: PublicUser) => person.id === direct.peer_id
                );
                const room = dmRoom(user?.id ?? 0, direct.peer_id);
                return (
                  <View key={direct.peer_id}>
                    {index > 0 ? <Divider /> : null}
                    <Pressable
                      onPress={() => openRoom(room)}
                      style={styles.dmRow}
                    >
                      <Pressable
                        onPress={() => setProfileId(direct.peer_id)}
                        hitSlop={6}
                        accessibilityLabel="پروفایل"
                      >
                        <Avatar
                          name={peer?.username}
                          uri={peer?.avatar_url}
                          size="sm"
                        />
                      </Pressable>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <View style={styles.rowBetween}>
                          <AppText
                            variant="label"
                            numberOfLines={1}
                            style={{ fontFamily: fonts.semibold }}
                            onPress={() => setProfileId(direct.peer_id)}
                          >
                            {peer?.username ?? "همکلاسی"}
                          </AppText>
                          <AppText variant="caption" color={colors.faint} style={{ fontSize: 10.5 }} ltr>
                            {faDate(direct.message.created_at, "time")}
                          </AppText>
                        </View>
                        <AppText variant="caption" color={colors.muted} numberOfLines={1}>
                          {direct.message.content.trim() || "📷 تصویر"}
                        </AppText>
                      </View>
                      {(unreadMap.get(room) ?? 0) > 0 ? (
                        <Badge count={unreadMap.get(room) ?? 0} />
                      ) : null}
                      <Ionicons name="chevron-back" size={14} color={colors.faint} />
                    </Pressable>
                  </View>
                );
              })}
            </SolidCard>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle
            title="کامنت‌های تکالیف"
            hint="اتاق هر تکلیف"
            actionLabel="تکالیف"
            onAction={() => router.push("/assignments")}
          />

          {recent.isLoading ? (
            <SkeletonRows count={2} height={72} />
          ) : (recent.data ?? []).length === 0 ? (
            <SolidCard>
              <EmptyState
                compact
                icon="document-text-outline"
                title="کامنت تازه‌ای نیست"
                hint="روی صفحهٔ هر تکلیف می‌توانی مستقیم کامنت بگذاری."
              />
            </SolidCard>
          ) : (
            <SolidCard style={{ paddingHorizontal: spacing.md }}>
              {(recent.data ?? []).map((message, index) => (
                <View key={message.id}>
                  {index > 0 ? <Divider /> : null}
                  <Pressable
                    onPress={() => {
                      if (message.assignment_id) {
                        router.push({
                          pathname: "/assignment/[id]",
                          params: { id: String(message.assignment_id) },
                        });
                      }
                    }}
                    style={styles.dmRow}
                  >
                    <Pressable
                      onPress={() => setProfileId(message.sender_id)}
                      hitSlop={6}
                      accessibilityLabel="پروفایل"
                    >
                      <Avatar
                        name={message.sender_username}
                        uri={message.sender_avatar_url}
                        size="sm"
                      />
                    </Pressable>
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <View style={styles.rowBetween}>
                        <AppText
                          variant="label"
                          numberOfLines={1}
                          style={{ flex: 1, fontFamily: fonts.semibold }}
                          onPress={() => setProfileId(message.sender_id)}
                        >
                          {message.sender_username ?? "همکلاسی"}
                        </AppText>
                        <AppText variant="caption" color={colors.faint} style={{ fontSize: 10.5 }} ltr>
                          {faDate(message.created_at, "time")}
                        </AppText>
                      </View>
                      <AppText variant="caption" color={colors.muted} numberOfLines={2}>
                        {message.content.trim() || "📷 تصویر"}
                      </AppText>
                      {message.assignment_title ? (
                        <View style={styles.assignmentTag}>
                          <Ionicons name="document-text-outline" size={11} color={colors.amber} />
                          <AppText variant="caption" color={colors.amber} numberOfLines={1} style={{ flex: 1 }}>
                            {message.assignment_title}
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                </View>
              ))}
            </SolidCard>
          )}
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      <Sheet
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="گفتگوی تازه"
        subtitle="یک همکلاسی را انتخاب کن"
      >
        {teamMembers.length === 0 ? (
          <EmptyState
            compact
            icon="people-outline"
            title="عضو دیگری پیدا نشد"
            hint="بعداً دوباره تلاش کن."
          />
        ) : (
          teamMembers.map((person: PublicUser) => (
            <Pressable
              key={person.id}
              onPress={() => openRoom(dmRoom(user?.id ?? 0, person.id))}
              style={styles.pickerRow}
            >
              <Avatar name={person.username} uri={person.avatar_url} size="sm" />
              <AppText variant="label" style={{ flex: 1 }}>
                {person.username}
              </AppText>
              {person.role ? (
                <Pill
                  label={roleLabel(person.role)}
                  tone={roleColor(person.role) as "amber" | "teal" | "red" | "blue" | "muted"}
                />
              ) : null}
              <Ionicons name="chevron-back" size={14} color={colors.faint} />
            </Pressable>
          ))
        )}
      </Sheet>

      <UserProfileModal userId={profileId} onClose={() => setProfileId(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenGutter,
    paddingBottom: 120,
  },
  globalCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  globalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberLine,
  },
  section: { paddingTop: spacing.xl },
  rowBetween: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
  },
  rowTight: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  dmRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  assignmentTag: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: colors.amberSoft,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  composeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberLine,
  },
  lockedWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: screenGutter,
    paddingBottom: 80,
  },
  lockedCard: {
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
  },
  lockIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberLine,
  },
  lockHint: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: "rgba(79,209,181,0.25)",
  },
  pickerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
});
