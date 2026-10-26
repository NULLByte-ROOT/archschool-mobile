import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState, type ComponentRef } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  fetchChatOverview,
  fetchRecentComments,
  fetchTeam,
  fetchUnread,
  qk,
} from "@/api/client";
import type { DirectPreview, Message, PublicUser } from "@/api/types";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/cards";
import {
  ChatCard,
  Eyebrow,
  GlassSurface,
  StatusDot,
  UnreadPill,
} from "@/components/chatkit";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { AppText, Avatar, Pill } from "@/components/ui";
import { UserProfileModal } from "@/components/UserProfileModal";
import { dmRoom } from "@/lib/chat";
import {
  calendarDayDiff,
  faDate,
  fmtNum,
  parseDue,
} from "@/lib/format";
import { canChat, roleColor, roleLabel } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";
import {
  colors,
  fonts,
  radius,
  screenGutter,
  spacing,
  tabBarReserve,
} from "@/theme/tokens";

const CHAT_LOCK_MESSAGE = "برای دسترسی به گفتگو، از ادمین اجازه بگیرید.";

/** Latin-digit clock for today, short Persian date for anything older. */
function stamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = parseDue(iso);
  if (!date) return "";
  const diff = calendarDayDiff(date, new Date());
  return diff === 0 ? faDate(date, "time") : faDate(date, "short");
}

function previewOf(message: Message | null | undefined): string {
  if (!message) return "هنوز پیامی نیست";
  return message.content.trim() || "📷 تصویر";
}

function globalPreview(message: Message | null | undefined): string {
  if (!message) return "اولین پیام را بفرست";
  const body = previewOf(message);
  return message.sender_username ? `${message.sender_username}: ${body}` : body;
}

function SectionHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string;
  title: string;
  meta?: string;
}) {
  return (
    <View style={s.sectionHead}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <AppText
          style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 23 }}
        >
          {title}
        </AppText>
      </View>
      {meta ? (
        <AppText
          ltr
          color={colors.faint}
          style={{
            fontSize: 10.5,
            lineHeight: 16,
            fontVariant: ["tabular-nums"],
          }}
        >
          {meta}
        </AppText>
      ) : null}
    </View>
  );
}

function RoleMicro({ role }: { role?: PublicUser["role"] }) {
  if (role !== "admin" && role !== "owner") return null;
  return (
    <View style={s.roleMicro}>
      <AppText
        ltr
        color="rgba(255,255,255,0.66)"
        style={{
          fontFamily: fonts.medium,
          fontSize: 8,
          lineHeight: 12,
          letterSpacing: 0.7,
        }}
      >
        {role === "owner" ? "OWNER" : "ADMIN"}
      </AppText>
    </View>
  );
}

function ChatEmpty({
  icon,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  hint: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={20} color={colors.white} />
      </View>
      <AppText
        align="center"
        style={{ fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 21 }}
      >
        {title}
      </AppText>
      <AppText
        align="center"
        color={colors.faint}
        style={{ fontSize: 11.5, lineHeight: 19, maxWidth: 280 }}
      >
        {hint}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync().catch(() => undefined);
            onAction();
          }}
          hitSlop={8}
          style={s.emptyAction}
        >
          <AppText
            color={colors.white}
            style={{ fontFamily: fonts.medium, fontSize: 12 }}
          >
            {actionLabel}
          </AppText>
          <Ionicons name="chevron-back" size={12} color={colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

function RingedAvatar({
  name,
  uri,
  active,
  onPress,
}: {
  name?: string | null;
  uri?: string | null;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="پروفایل"
      style={[
        s.avatarRing,
        { borderColor: active ? "rgba(255,255,255,0.85)" : "transparent" },
      ]}
    >
      <Avatar name={name} uri={uri} size="md" />
    </Pressable>
  );
}

function LockedChat() {
  const router = useRouter();
  return (
    <View style={s.lockedWrap}>
      <GlassSurface
        style={{ borderRadius: radius.xl }}
        contentStyle={s.lockedCard}
      >
        <View style={s.lockIcon}>
          <Ionicons name="lock-closed" size={24} color={colors.white} />
        </View>
        <AppText
          align="center"
          style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 26 }}
        >
          گفتگو قفل است
        </AppText>
        <AppText
          align="center"
          color={colors.faint}
          style={{ fontSize: 12.5, lineHeight: 21 }}
        >
          {CHAT_LOCK_MESSAGE}
        </AppText>
        <View style={s.lockHint}>
          <Ionicons
            name="chatbox-ellipses-outline"
            size={14}
            color={colors.success}
          />
          <AppText
            color={colors.muted}
            style={{ flex: 1, fontSize: 11.5, lineHeight: 18 }}
          >
            کامنت گذاشتن روی تکالیف برای همهٔ اعضا آزاد است.
          </AppText>
        </View>
        <Button
          label="دیدن تکالیف"
          icon="checkbox-outline"
          variant="ghost"
          onPress={() => router.push("/assignments")}
        />
      </GlassSurface>
    </View>
  );
}

export default function ChatHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [composerOpen, setComposerOpen] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef<ComponentRef<typeof TextInput>>(null);

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
    queryFn: () => fetchRecentComments(20),
    enabled: !member,
  });
  const unread = useQuery({
    queryKey: qk.unread,
    queryFn: fetchUnread,
    enabled: !member,
  });

  const unreadMap = useMemo(
    () =>
      new Map(
        (unread.data?.rooms ?? []).map((room) => [
          room.room,
          room.unread_count,
        ])
      ),
    [unread.data]
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

  const teamMembers = useMemo(
    () => (team.data ?? []).filter((person) => person.id !== user?.id),
    [team.data, user?.id]
  );

  /** One row per teammate with a conversation, newest message first. */
  const dmRows = useMemo(() => {
    const directs = chats.data?.directs ?? [];
    return directs.map((direct: DirectPreview) => {
      const room = dmRoom(user?.id ?? 0, direct.peer_id);
      return {
        peerId: direct.peer_id,
        peer: teamMembers.find((person) => person.id === direct.peer_id),
        message: direct.message,
        room,
        unread: unreadMap.get(room) ?? 0,
      };
    });
  }, [chats.data, teamMembers, unreadMap, user?.id]);

  /** Assignment comment rooms, grouped from the already-fetched comments. */
  const assignmentRows = useMemo(() => {
    const rows = new Map<
      number,
      { id: number; title: string; message: Message; unread: number }
    >();
    for (const message of recent.data ?? []) {
      if (message.assignment_id == null) continue;
      if (rows.has(message.assignment_id)) continue;
      rows.set(message.assignment_id, {
        id: message.assignment_id,
        title: message.assignment_title?.trim() || `تکلیف ${String(message.assignment_id)}`,
        message,
        unread: unreadMap.get(`assignment:${message.assignment_id}`) ?? 0,
      });
    }
    return [...rows.values()];
  }, [recent.data, unreadMap]);

  const needle = query.trim().toLowerCase();
  const hit = (...parts: (string | null | undefined)[]) =>
    !needle ||
    parts.some((part) => (part ?? "").toLowerCase().includes(needle));

  const visibleDms = dmRows.filter((row) =>
    hit(row.peer?.username, row.message.content)
  );
  const visibleAssignments = assignmentRows.filter((row) =>
    hit(row.title, row.message.content, row.message.sender_username)
  );
  const globalVisible = hit(
    "گروه عمومی",
    "global",
    chats.data?.global_message?.content,
    chats.data?.global_message?.sender_username
  );

  const unreadTotal = unread.data?.total ?? 0;
  const conversationCount = 1 + dmRows.length + assignmentRows.length;
  const subtitle = unreadTotal
    ? `${fmtNum(unreadTotal)} پیام خوانده‌نشده · ${fmtNum(conversationCount)} گفتگو`
    : `همه خوانده شده · ${fmtNum(conversationCount)} گفتگو`;

  const focusSearch = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    searchRef.current?.focus();
  };

  const openComposer = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined
    );
    setComposerOpen(true);
  };

  if (member) {
    return (
      <Screen edges={["top"]} grid={false}>
        <View style={s.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText style={s.title}>گفتگو</AppText>
            <AppText color={colors.faint} style={s.subtitle}>
              دسترسی محدود
            </AppText>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          <LockedChat />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]} grid={false}>
      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingBottom: tabBarReserve + insets.bottom + 96 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.white}
            colors={[colors.white]}
            progressBackgroundColor={colors.panel}
          />
        }
      >
        <View style={s.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText style={s.title}>گفتگوها</AppText>
            <AppText color={colors.faint} numberOfLines={1} style={s.subtitle}>
              {subtitle}
            </AppText>
          </View>

          <Pressable
            onPress={focusSearch}
            accessibilityRole="button"
            accessibilityLabel="جستجو"
            hitSlop={6}
          >
            <GlassSurface
              style={{ borderRadius: 22 }}
              contentStyle={s.headerButton}
            >
              <Ionicons name="search" size={18} color={colors.white} />
            </GlassSurface>
          </Pressable>
        </View>

        <GlassSurface style={s.searchPill} contentStyle={s.searchInner}>
          <Ionicons name="search" size={16} color={colors.faint} />
          <TextInput
            ref={searchRef}
            value={query}
            onChangeText={setQuery}
            placeholder="جستجوی هم‌کلاسی…"
            placeholderTextColor={colors.faint}
            selectionColor={colors.white}
            returnKeyType="search"
            style={s.searchInput}
          />
          {query ? (
            <Pressable
              onPress={() => setQuery("")}
              hitSlop={10}
              accessibilityLabel="پاک کردن جستجو"
            >
              <Ionicons
                name="close-circle"
                size={16}
                color={colors.faint}
              />
            </Pressable>
          ) : null}
        </GlassSurface>

        {globalVisible ? (
          <View style={s.pinnedSection}>
            <SectionHeader
              eyebrow="// PINNED"
              title="گروه عمومی"
              meta={`${fmtNum(teamMembers.length + 1)} عضو`}
            />
            <ChatCard
              index={0}
              onPress={() => openRoom("global")}
              accessibilityLabel="گروه عمومی"
              style={{ borderRadius: 20 }}
            >
              <View style={s.globalTile}>
                <Ionicons name="people" size={24} color={colors.white} />
              </View>

              <View style={s.main}>
                <View style={s.topLine}>
                  <AppText
                    numberOfLines={1}
                    style={s.name}
                  >
                    گروه عمومی
                  </AppText>
                  <AppText ltr color={colors.faint} style={s.time}>
                    {stamp(chats.data?.global_message?.created_at)}
                  </AppText>
                </View>

                <AppText
                  numberOfLines={1}
                  color={colors.faint}
                  style={s.preview}
                >
                  {globalPreview(chats.data?.global_message)}
                </AppText>

                <View style={s.bottomLine}>
                  <View style={s.liveRow}>
                    <StatusDot tone={colors.success} />
                    <AppText color={colors.faint} style={s.liveText}>
                      گفتگوی زندهٔ کلاس
                    </AppText>
                  </View>
                  <UnreadPill count={unreadMap.get("global") ?? 0} size={20} />
                </View>
              </View>
            </ChatCard>
          </View>
        ) : null}

        <View style={s.section}>
          <SectionHeader
            eyebrow="// DIRECT MESSAGES"
            title="پیام‌های خصوصی"
            meta={dmRows.length ? `${fmtNum(dmRows.length)} گفتگو` : undefined}
          />

          {chats.isLoading ? (
            <View style={{ gap: spacing.xs }}>
              {[0, 1].map((key) => (
                <View key={key} style={s.skeleton} />
              ))}
            </View>
          ) : visibleDms.length === 0 ? (
            <ChatEmpty
              icon={needle ? "search-outline" : "chatbubbles-outline"}
              title={needle ? "نتیجه‌ای پیدا نشد" : "پیام خصوصی نداری"}
              hint={
                needle
                  ? "نام دیگری را جستجو کن."
                  : "هنوز پیامی نداری. از پروفایل یکی از همکلاسی‌ها شروع کن."
              }
              actionLabel={needle ? undefined : "شروع گفتگو"}
              onAction={needle ? undefined : openComposer}
            />
          ) : (
            <View style={{ gap: 10 }}>
              {visibleDms.map((row, index) => (
                <ChatCard
                  key={row.peerId}
                  index={index + 1}
                  onPress={() => openRoom(row.room)}
                  accessibilityLabel={`گفتگو با ${row.peer?.username ?? "همکلاسی"}`}
                >
                  <RingedAvatar
                    name={row.peer?.username}
                    uri={row.peer?.avatar_url}
                    active={row.unread > 0}
                    onPress={() => setProfileId(row.peerId)}
                  />

                  <View style={s.main}>
                    <View style={s.topLine}>
                      <View style={s.nameRow}>
                        <AppText numberOfLines={1} style={s.name}>
                          {row.peer?.username ?? "همکلاسی"}
                        </AppText>
                        <RoleMicro role={row.peer?.role} />
                      </View>
                      <AppText ltr color={colors.faint} style={s.time}>
                        {stamp(row.message.created_at)}
                      </AppText>
                    </View>

                    <View style={s.bottomLine}>
                      <AppText
                        numberOfLines={1}
                        color={colors.faint}
                        style={s.preview}
                      >
                        {previewOf(row.message)}
                      </AppText>
                      <UnreadPill count={row.unread} />
                    </View>
                  </View>
                </ChatCard>
              ))}
            </View>
          )}
        </View>

        <View style={s.section}>
          <SectionHeader
            eyebrow="// ASSIGNMENT ROOMS"
            title="کامنت‌های تکالیف"
            meta={
              assignmentRows.length
                ? `${fmtNum(assignmentRows.length)} اتاق`
                : undefined
            }
          />

          {recent.isLoading ? (
            <View style={{ gap: spacing.xs }}>
              {[0, 1].map((key) => (
                <View key={key} style={s.skeleton} />
              ))}
            </View>
          ) : visibleAssignments.length === 0 ? (
            <ChatEmpty
              icon={needle ? "search-outline" : "document-text-outline"}
              title={needle ? "نتیجه‌ای پیدا نشد" : "کامنتی ثبت نشده"}
              hint={
                needle
                  ? "نام تکلیف دیگری را جستجو کن."
                  : "هنوز کامنتی روی تکالیف ثبت نشده."
              }
              actionLabel={needle ? undefined : "دیدن تکالیف"}
              onAction={
                needle ? undefined : () => router.push("/assignments")
              }
            />
          ) : (
            <View style={{ gap: 10 }}>
              {visibleAssignments.map((row, index) => (
                <ChatCard
                  key={row.id}
                  index={index + visibleDms.length + 1}
                  onPress={() =>
                    router.push({
                      pathname: "/assignment/[id]",
                      params: { id: String(row.id) },
                    })
                  }
                  accessibilityLabel={`کامنت‌های ${row.title}`}
                >
                  <View style={s.docTile}>
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color={colors.white}
                    />
                  </View>

                  <View style={s.main}>
                    <View style={s.topLine}>
                      <AppText numberOfLines={1} style={s.name}>
                        {row.title}
                      </AppText>
                      <AppText ltr color={colors.faint} style={s.time}>
                        {stamp(row.message.created_at)}
                      </AppText>
                    </View>

                    <AppText
                      numberOfLines={1}
                      color={colors.faint}
                      style={s.preview}
                    >
                      {`${row.message.sender_username ?? "همکلاسی"}: ${previewOf(
                        row.message
                      )}`}
                    </AppText>

                    <View style={s.bottomLine}>
                      <View style={s.roomChip}>
                        <Ionicons
                          name="chatbubble-ellipses-outline"
                          size={10}
                          color="rgba(255,255,255,0.7)"
                        />
                        <AppText
                          color="rgba(255,255,255,0.7)"
                          style={{ fontSize: 9.5, lineHeight: 14 }}
                        >
                          اتاق کامنت
                        </AppText>
                      </View>
                      <UnreadPill count={row.unread} />
                    </View>
                  </View>
                </ChatCard>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Pressable
        onPress={openComposer}
        accessibilityRole="button"
        accessibilityLabel="گفتگوی تازه"
        style={[s.fab, { bottom: tabBarReserve + insets.bottom + 14 }]}
      >
        <GlassSurface
          intensity={44}
          style={{ borderRadius: 28 }}
          contentStyle={s.fabInner}
        >
          <Ionicons name="create-outline" size={22} color={colors.white} />
        </GlassSurface>
      </Pressable>

      <Sheet
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="گفتگوی تازه"
        subtitle="یک هم‌کلاسی را انتخاب کن"
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
              onPress={() => {
                void Haptics.selectionAsync().catch(() => undefined);
                openRoom(dmRoom(user?.id ?? 0, person.id));
              }}
              style={({ pressed }) => [
                s.pickerRow,
                pressed && { backgroundColor: colors.white04 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`گفتگو با ${person.username}`}
            >
              <Avatar name={person.username} uri={person.avatar_url} size="md" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.semibold,
                    fontSize: 13.5,
                    lineHeight: 21,
                  }}
                >
                  {person.username}
                </AppText>
                <AppText color={colors.faint} style={{ fontSize: 10.5 }}>
                  {roleLabel(person.role)}
                </AppText>
              </View>
              {person.role ? (
                <Pill
                  label={roleLabel(person.role)}
                  tone={roleColor(person.role) as
                    | "amber"
                    | "teal"
                    | "red"
                    | "blue"
                    | "muted"}
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

const s = StyleSheet.create({
  content: {
    paddingHorizontal: screenGutter,
    paddingTop: 4,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.black,
    fontSize: 30,
    lineHeight: 40,
    letterSpacing: -0.4,
    color: colors.accent,
    textAlign: "right",
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 18,
    textAlign: "right",
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  searchPill: {
    borderRadius: radius.pill,
  },
  searchInner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    height: 46,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: colors.accent,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    paddingVertical: 0,
    textAlign: "right",
    writingDirection: "rtl",
  },
  pinnedSection: {
    paddingTop: spacing.xl,
  },
  section: {
    paddingTop: spacing.xl,
  },
  sectionHead: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  globalTile: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white08,
    borderWidth: 1,
    borderColor: colors.white12,
  },
  docTile: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white06,
    borderWidth: 1,
    borderColor: colors.white10,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  topLine: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
  },
  bottomLine: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
  },
  nameRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  name: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.accent,
    textAlign: "right",
  },
  time: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 15,
    fontVariant: ["tabular-nums"],
  },
  preview: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 18,
    textAlign: "right",
    writingDirection: "rtl",
  },
  liveRow: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  liveText: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 15,
  },
  roleMicro: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: colors.white04,
  },
  roomChip: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
  },
  skeleton: {
    height: 74,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white03,
    opacity: 0.6,
  },
  empty: {
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.015)",
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white06,
    borderWidth: 1,
    borderColor: colors.white10,
    marginBottom: 2,
  },
  emptyAction: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.white15,
    backgroundColor: colors.white06,
  },
  fab: {
    position: "absolute",
    right: screenGutter,
    width: 56,
    height: 56,
  },
  fabInner: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
  },
  pickerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
    minHeight: 56,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white06,
    borderWidth: 1,
    borderColor: colors.white12,
  },
  lockHint: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.successLine,
  },
});
