import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiError,
  createUser,
  deleteUser,
  fetchUsers,
  qk,
  updateUser,
  updateUserCode,
} from "@/api/client";
import type { Role, User } from "@/api/types";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { SelectSheet, type SelectOption } from "@/components/SelectSheet";
import { Sheet } from "@/components/Sheet";
import { AppText, Avatar } from "@/components/ui";
import { Kicker, MonoLabel, Panel, PulseDot } from "@/components/webui";
import { faDate, fmtNum, parseDue } from "@/lib/format";
import { isOwner } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";
import {
  colors,
  fonts,
  radius,
  screenGutter,
  spacing,
  tabBarReserve,
} from "@/theme/tokens";

/* ------------------------------------------------------------------ */
/* role metadata — copied 1:1 from the web UsersPage                   */
/* ------------------------------------------------------------------ */

const ROLE_OPTIONS: SelectOption[] = [
  {
    value: "owner",
    label: "Owner (مالک)",
    description: "دسترسی کامل + آمار سرور + تغییر کدها",
  },
  { value: "admin", label: "مدیر (Admin)", description: "مدیریت تکالیف و کاربران" },
  { value: "friend", label: "دوست (Friend)", description: "گفتگو و کامنت، بدون مدیریت تکلیف" },
  { value: "member", label: "عضو (Member)", description: "فقط مشاهده، اعلام انجام و کامنت تکلیف" },
];

const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  friend: "Friend",
  member: "Member",
};

const ROLE_BADGE: Record<Role, { border: string; text: string }> = {
  owner: { border: "rgba(255,255,255,0.28)", text: colors.white },
  admin: { border: "rgba(255,255,255,0.40)", text: colors.white },
  friend: { border: "rgba(125,211,252,0.35)", text: colors.blue },
  member: { border: colors.white12, text: colors.faint },
};

const CODE_HINT = "دقیقاً ۶ کاراکتر انگلیسی بزرگ یا رقم";

/* ------------------------------------------------------------------ */
/* row pieces                                                          */
/* ------------------------------------------------------------------ */

function RoleBadge({ role, self }: { role: Role; self: boolean }) {
  const tone = ROLE_BADGE[role] ?? ROLE_BADGE.member;
  return (
    <View style={[styles.roleBadge, { borderColor: tone.border }]}>
      <PulseDot size={4} tone={tone.text} glow={false} />
      <AppText
        ltr
        color={tone.text}
        style={{ fontFamily: fonts.bold, fontSize: 8.5, lineHeight: 12, letterSpacing: 0.8 }}
      >
        {ROLE_LABELS[role] ?? role}
        {self ? " (شما)" : ""}
      </AppText>
    </View>
  );
}

function ControlButton({
  icon,
  label,
  tone = colors.faint,
  border = colors.white10,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  tone?: string;
  border?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [
        styles.controlButton,
        { borderColor: border },
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.75 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={15} color={tone} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* screen                                                              */
/* ------------------------------------------------------------------ */

export default function UsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const me = useAuthStore((state) => state.user);
  const owner = isOwner(me);

  const [search, setSearch] = useState("");
  const [roleTarget, setRoleTarget] = useState<User | null>(null);
  const [savingRole, setSavingRole] = useState<number | null>(null);

  const [codeTarget, setCodeTarget] = useState<User | null>(null);
  const [codeValue, setCodeValue] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [savingCode, setSavingCode] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newCode, setNewCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({ queryKey: qk.users, queryFn: fetchUsers });

  const users = useMemo(() => query.data ?? [], [query.data]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (person) =>
        person.username.toLowerCase().includes(needle) ||
        (person.code ?? "").toLowerCase().includes(needle) ||
        (ROLE_LABELS[person.role] ?? person.role).toLowerCase().includes(needle)
    );
  }, [users, search]);

  const activeCount = users.filter((person) => person.is_active).length;
  const roleOptions = owner ? ROLE_OPTIONS : ROLE_OPTIONS.filter((o) => o.value !== "owner");

  const patchLocalUser = (updated: User) => {
    queryClient.setQueryData<User[]>(qk.users, (current) =>
      (current ?? []).map((person) => (person.id === updated.id ? updated : person))
    );
    void queryClient.invalidateQueries({ queryKey: qk.team });
    void queryClient.invalidateQueries({ queryKey: qk.leaderboard });
  };

  const changeRole = (target: User, role: Role) => {
    if (role === target.role) return;
    const apply = () => {
      setSavingRole(target.id);
      setError(null);
      void (async () => {
        try {
          const updated = await updateUser(target.id, { role });
          patchLocalUser(updated);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => undefined
          );
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "تغییر نقش ناموفق بود");
        } finally {
          setSavingRole(null);
        }
      })();
    };

    if (role === "owner") {
      Alert.alert(
        "سپردن نقش Owner",
        `«${target.username}» دسترسی کامل، از جمله آمار سرور و تغییر کد همهٔ اعضا را می‌گیرد. مطمئنی؟`,
        [
          { text: "انصراف", style: "cancel" },
          { text: "بده", style: "destructive", onPress: apply },
        ]
      );
      return;
    }
    apply();
  };

  const toggleActive = (target: User) => {
    setError(null);
    void (async () => {
      try {
        const updated = await updateUser(target.id, { is_active: !target.is_active });
        patchLocalUser(updated);
        void Haptics.selectionAsync().catch(() => undefined);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "تغییر وضعیت انجام نشد");
      }
    })();
  };

  const openCodeSheet = (target: User) => {
    setCodeTarget(target);
    setCodeValue("");
    setCodeError(null);
  };

  const saveCode = () => {
    if (!codeTarget) return;
    const code = codeValue.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setCodeError(CODE_HINT);
      return;
    }
    setSavingCode(true);
    setCodeError(null);
    void (async () => {
      try {
        const updated = await updateUserCode(codeTarget.id, code);
        patchLocalUser(updated);
        setCodeTarget(null);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined
        );
        Alert.alert("ذخیره شد", `کد دسترسی «${updated.username}» به ${code} تغییر کرد.`);
      } catch (err) {
        setCodeError(err instanceof ApiError ? err.message : "تغییر کد ناموفق بود");
      } finally {
        setSavingCode(false);
      }
    })();
  };

  const confirmDelete = (target: User) => {
    Alert.alert("حذف حساب", "مطمئنی؟ این کاربر حذف می‌شه.", [
      { text: "انصراف", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteUser(target.id);
              await queryClient.invalidateQueries({ queryKey: qk.users });
              void queryClient.invalidateQueries({ queryKey: qk.team });
              void queryClient.invalidateQueries({ queryKey: qk.leaderboard });
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "خطا در حذف");
            }
          })();
        },
      },
    ]);
  };

  const shareCredentials = (user: User) => {
    void Share.share({
      message: `ورود به ArchSchool\nنام کاربری: ${user.username}\nکد دسترسی: ${
        user.code ?? "—"
      }\nنشانی: https://archschool.vidxsepehr.ir`,
    }).catch(() => undefined);
  };

  const openCreate = () => {
    setNewUsername("");
    setNewCode("");
    setCreated(null);
    setError(null);
    setCreateOpen((current) => !current);
  };

  const submitCreate = () => {
    const username = newUsername.trim();
    if (!username) return;
    const code = newCode.trim().toUpperCase();
    if (code && !/^[A-Z0-9]{6}$/.test(code)) {
      setError(CODE_HINT);
      return;
    }
    setCreating(true);
    setError(null);
    void (async () => {
      try {
        const user = await createUser({ username, code: code || undefined });
        setCreated(user);
        setNewUsername("");
        setNewCode("");
        void queryClient.invalidateQueries({ queryKey: qk.users });
        void queryClient.invalidateQueries({ queryKey: qk.team });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined
        );
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "خطا در ساخت کاربر");
      } finally {
        setCreating(false);
      }
    })();
  };

  return (
    <Screen edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarReserve + insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.amber}
            colors={[colors.amber]}
            progressBackgroundColor={colors.panel}
          />
        }
      >
        {/* header */}
        <Animated.View entering={FadeInDown.duration(180)} style={{ marginBottom: 16 }}>
          <Kicker text="admin" dot style={{ marginBottom: 10 }} />

          <View style={styles.headerRow}>
            <View style={{ flexShrink: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="بازگشت"
                  style={styles.backButton}
                >
                  <Ionicons name="chevron-forward" size={15} color={colors.textSoft} />
                </Pressable>
                <AppText
                  style={{
                    fontFamily: fonts.black,
                    fontSize: 24,
                    lineHeight: 33,
                    letterSpacing: -0.4,
                  }}
                >
                  کاربران
                </AppText>
              </View>
              <AppText color={colors.faint} style={{ fontSize: 13, lineHeight: 22, marginTop: 4 }}>
                ساخت و مدیریت کاربران و کدهای ورود
              </AppText>
            </View>

            <Pressable
              onPress={openCreate}
              style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
              accessibilityLabel="کاربر جدید"
            >
              <View style={styles.primaryBadge}>
                <Ionicons name={createOpen ? "close" : "add"} size={14} color={colors.white} />
              </View>
              <AppText
                color={colors.black}
                style={{ fontFamily: fonts.black, fontSize: 12, lineHeight: 18 }}
              >
                کاربر جدید
              </AppText>
            </Pressable>
          </View>
        </Animated.View>

        {/* new user panel */}
        {createOpen ? (
          <Animated.View entering={FadeInDown.duration(180)} style={{ marginBottom: 16 }}>
            <Panel corners contentStyle={styles.panelPad}>
              <MonoLabel style={{ marginBottom: 10 }}>// NEW USER</MonoLabel>

              {created ? (
                <View style={styles.createdBox}>
                  <View style={styles.createdIcon}>
                    <Ionicons name="checkmark-circle" size={26} color={colors.success} />
                  </View>
                  <AppText style={{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 21 }}>
                    حساب ساخته شد
                  </AppText>

                  <View style={styles.credentialCard}>
                    <View style={styles.credentialRow}>
                      <MonoLabel>USERNAME</MonoLabel>
                      <AppText ltr style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
                        {created.username}
                      </AppText>
                    </View>
                    <View style={styles.credentialRow}>
                      <MonoLabel>ACCESS CODE</MonoLabel>
                      <AppText
                        ltr
                        color={colors.amber}
                        style={{
                          fontFamily: fonts.black,
                          fontSize: 18,
                          lineHeight: 26,
                          letterSpacing: 4,
                        }}
                      >
                        {created.code ?? "—"}
                      </AppText>
                    </View>
                  </View>

                  <View style={styles.createdActions}>
                    <Pressable
                      onPress={() => shareCredentials(created)}
                      style={({ pressed }) => [styles.ghostButton, pressed && { opacity: 0.85 }]}
                      accessibilityRole="button"
                    >
                      <Ionicons name="share-social-outline" size={14} color={colors.textSoft} />
                      <AppText color={colors.textSoft} style={{ fontFamily: fonts.semibold, fontSize: 11.5 }}>
                        هم‌رسانی
                      </AppText>
                    </Pressable>
                    <Pressable
                      onPress={() => setCreated(null)}
                      style={({ pressed }) => [styles.ghostButton, pressed && { opacity: 0.85 }]}
                      accessibilityRole="button"
                    >
                      <Ionicons name="person-add-outline" size={14} color={colors.textSoft} />
                      <AppText color={colors.textSoft} style={{ fontFamily: fonts.semibold, fontSize: 11.5 }}>
                        کاربر دیگر
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <Field
                    value={newUsername}
                    onChangeText={setNewUsername}
                    placeholder="نام کاربری"
                    ltr
                    maxLength={50}
                  />
                  <View style={{ height: 10 }} />
                  <Field
                    value={newCode}
                    onChangeText={(value) => setNewCode(value.toUpperCase())}
                    placeholder="کد ۶ کاراکتری (خالی = تصادفی)"
                    ltr
                    maxLength={6}
                    autoCapitalize="characters"
                  />
                  <Pressable
                    onPress={submitCreate}
                    disabled={creating || !newUsername.trim()}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { alignSelf: "flex-start", marginTop: 12 },
                      (creating || !newUsername.trim()) && { opacity: 0.5 },
                      pressed && { opacity: 0.85 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="ساخت کاربر"
                  >
                    {creating ? (
                      <ActivityIndicator size="small" color={colors.black} />
                    ) : (
                      <View style={styles.primaryBadge}>
                        <Ionicons name="add" size={14} color={colors.white} />
                      </View>
                    )}
                    <AppText color={colors.black} style={{ fontFamily: fonts.black, fontSize: 12 }}>
                      ساخت
                    </AppText>
                  </Pressable>
                  <AppText color={colors.faint} style={{ fontSize: 10.5, lineHeight: 17, marginTop: 10 }}>
                    اگه کد خالی بذاری، یه کد ۶ کاراکتری ساخته می‌شه و اینجا نمایش داده می‌شه.
                  </AppText>
                </>
              )}
            </Panel>
          </Animated.View>
        ) : null}

        {/* error banner */}
        {error ? (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={14} color={colors.danger} />
            <AppText color={colors.danger} style={{ fontSize: 11.5, lineHeight: 18, flex: 1 }}>
              {error}
            </AppText>
            <Pressable onPress={() => setError(null)} hitSlop={8} accessibilityLabel="بستن خطا">
              <Ionicons name="close" size={14} color={colors.danger} />
            </Pressable>
          </Animated.View>
        ) : null}

        {/* search + count */}
        <View style={styles.searchPanel}>
          <Ionicons name="search-outline" size={15} color={colors.faint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="جست‌وجوی نام، کد یا نقش…"
            placeholderTextColor={colors.faint}
            selectionColor={colors.amber}
            cursorColor={colors.amber}
            style={styles.searchInput}
            accessibilityLabel="جست‌وجوی کاربران"
          />
          <View style={styles.badge}>
            <AppText ltr color={colors.textSoft} style={{ fontSize: 10, lineHeight: 14 }}>
              {fmtNum(activeCount)}/{fmtNum(users.length)}
            </AppText>
          </View>
        </View>

        {/* list */}
        {query.isLoading && users.length === 0 ? (
          <Panel corners contentStyle={styles.loadingBox}>
            <ActivityIndicator color={colors.textSoft} />
            <AppText color={colors.faint} style={{ fontSize: 12 }}>
              در حال بارگذاری...
            </AppText>
          </Panel>
        ) : query.isError && users.length === 0 ? (
          <Panel corners contentStyle={styles.emptyBox}>
            <Ionicons name="cloud-offline-outline" size={26} color={colors.danger} />
            <AppText style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
              فهرست اعضا باز نشد
            </AppText>
            <Pressable
              onPress={() => void query.refetch()}
              style={({ pressed }) => [styles.primaryButton, { marginTop: 6 }, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <AppText color={colors.black} style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                تلاش دوباره
              </AppText>
            </Pressable>
          </Panel>
        ) : filtered.length === 0 ? (
          <Panel corners contentStyle={styles.emptyBox}>
            <Ionicons name="people-outline" size={26} color={colors.faint} />
            <AppText color={colors.faint} style={{ fontSize: 12.5 }}>
              {search.trim() ? "عضوی پیدا نشد" : "هنوز کاربری نیست"}
            </AppText>
          </Panel>
        ) : (
          <Panel corners>
            {filtered.map((person, index) => {
              const self = person.id === me?.id;
              const rowOwner = person.role === "owner";
              const canTouch = owner || !rowOwner;
              const busyRole = savingRole === person.id;

              return (
                <Animated.View
                  key={person.id}
                  entering={FadeInDown.duration(180).delay(Math.min(index * 25, 200))}
                  style={[
                    styles.userRow,
                    index > 0 && styles.userRowDivider,
                    !person.is_active && { opacity: 0.62 },
                  ]}
                >
                  {/* 1 — identity */}
                  <View style={styles.identityRow}>
                    <Avatar name={person.username} uri={person.avatar_url} size="sm" ring={self} />
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <View style={styles.nameRow}>
                        <AppText
                          ltr
                          numberOfLines={1}
                          style={{
                            fontFamily: fonts.semibold,
                            fontSize: 13.5,
                            lineHeight: 20,
                            flexShrink: 1,
                          }}
                        >
                          {person.username}
                        </AppText>
                        <RoleBadge role={person.role} self={self} />
                      </View>
                      <AppText ltr color={colors.faint} style={{ fontSize: 10.5, lineHeight: 15 }}>
                        {parseDue(person.created_at)
                          ? faDate(person.created_at, "short")
                          : "—"}
                      </AppText>
                    </View>
                  </View>

                  {/* 2 — role */}
                  <View style={[styles.roleRow, !canTouch && { opacity: 0.5 }]}>
                    <Ionicons name="shield-checkmark-outline" size={13} color={colors.faint} />
                    {canTouch ? (
                      <Pressable
                        onPress={() => setRoleTarget(person)}
                        disabled={busyRole}
                        style={({ pressed }) => [
                          styles.roleSelect,
                          pressed && { opacity: 0.85 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`نقش ${person.username}`}
                      >
                        <AppText
                          numberOfLines={1}
                          color={colors.textSoft}
                          style={{ fontSize: 11.5, lineHeight: 17, flex: 1, textAlign: "right" }}
                        >
                          {roleOptions.find((option) => option.value === person.role)?.label ??
                            ROLE_LABELS[person.role]}
                        </AppText>
                        <Ionicons name="chevron-down" size={13} color={colors.faint} />
                      </Pressable>
                    ) : (
                      <View style={styles.roleSelect}>
                        <AppText
                          ltr
                          color={colors.faint}
                          style={{ fontSize: 11, lineHeight: 17, flex: 1 }}
                        >
                          Owner — بدون تغییر
                        </AppText>
                      </View>
                    )}
                    {busyRole ? (
                      <ActivityIndicator size="small" color={colors.faint} />
                    ) : null}
                  </View>

                  {/* 3 — controls */}
                  <View style={styles.controlRow}>
                    {owner ? (
                      <ControlButton
                        icon="key-outline"
                        label={`تغییر کد دسترسی ${person.username}`}
                        onPress={() => openCodeSheet(person)}
                      />
                    ) : null}

                    <View
                      style={[
                        styles.statusPill,
                        {
                          borderColor: person.is_active ? colors.successLine : colors.white10,
                          backgroundColor: person.is_active ? colors.successSoft : colors.white05,
                        },
                      ]}
                    >
                      <AppText
                        ltr
                        color={person.is_active ? colors.success : colors.faint}
                        style={{
                          fontFamily: fonts.bold,
                          fontSize: 9.5,
                          lineHeight: 14,
                          letterSpacing: 0.8,
                        }}
                      >
                        {person.is_active ? "ACTIVE" : "OFF"}
                      </AppText>
                    </View>

                    {person.code ? (
                      <Pressable
                        onPress={() => shareCredentials(person)}
                        style={({ pressed }) => [styles.codeChip, pressed && { opacity: 0.8 }]}
                        accessibilityRole="button"
                        accessibilityLabel={`هم‌رسانی کد ${person.username}`}
                      >
                        <Ionicons name="copy-outline" size={11} color={colors.faint} />
                        <AppText
                          ltr
                          color={colors.textSoft}
                          style={{
                            fontFamily: fonts.medium,
                            fontSize: 11,
                            lineHeight: 16,
                            letterSpacing: 1.6,
                          }}
                        >
                          {person.code}
                        </AppText>
                      </Pressable>
                    ) : null}

                    <View style={{ flex: 1 }} />

                    {canTouch ? (
                      <>
                        <ControlButton
                          icon="power-outline"
                          label={person.is_active ? "غیرفعال کردن" : "فعال کردن"}
                          tone={person.is_active ? colors.warning : colors.success}
                          border={person.is_active ? colors.amberLine : colors.successLine}
                          onPress={() => toggleActive(person)}
                        />
                        {person.role !== "admin" && !rowOwner ? (
                          <ControlButton
                            icon="trash-outline"
                            label="حذف حساب"
                            tone={colors.danger}
                            border={colors.dangerLine}
                            onPress={() => confirmDelete(person)}
                          />
                        ) : null}
                      </>
                    ) : null}
                  </View>
                </Animated.View>
              );
            })}
          </Panel>
        )}

        <View style={styles.note}>
          <Ionicons name="shield-half-outline" size={13} color={colors.faint} />
          <AppText color={colors.faint} style={{ fontSize: 10.5, lineHeight: 17, flex: 1 }}>
            فقط Owner می‌تواند نقش Owner بسازد یا کد دسترسی اعضا را تغییر دهد. ادمین‌ها تکالیف،
            گفتگو و نقش‌های عضو/فرند/ادمین را مدیریت می‌کنند.
          </AppText>
        </View>
      </ScrollView>

      {/* role picker */}
      <SelectSheet
        visible={roleTarget !== null}
        title={`نقش ${roleTarget?.username ?? ""}`}
        options={roleOptions}
        value={roleTarget?.role ?? "member"}
        onSelect={(value) => {
          if (roleTarget) changeRole(roleTarget, value as Role);
          setRoleTarget(null);
        }}
        onClose={() => setRoleTarget(null)}
      />

      {/* owner: change access code */}
      <Sheet
        visible={codeTarget !== null}
        onClose={() => setCodeTarget(null)}
        title="تغییر کد دسترسی"
        subtitle={codeTarget?.username}
        footer={
          <Button label="ذخیرهٔ کد" icon="key-outline" onPress={saveCode} loading={savingCode} />
        }
      >
        <View style={styles.codeHead}>
          <Avatar name={codeTarget?.username} uri={codeTarget?.avatar_url} size="sm" />
          <View style={{ flex: 1, gap: 1 }}>
            <AppText style={{ fontFamily: fonts.semibold, fontSize: 13 }}>{codeTarget?.username}</AppText>
            <AppText ltr color={colors.faint} style={{ fontSize: 10.5 }}>
              کد فعلی: {codeTarget?.code ?? "—"}
            </AppText>
          </View>
        </View>

        <Field
          label="کد جدید"
          value={codeValue}
          onChangeText={(value) => setCodeValue(value.toUpperCase())}
          placeholder="مثلاً A7K2Q9"
          hint={CODE_HINT}
          error={codeError}
          ltr
          maxLength={6}
          autoCapitalize="characters"
        />

        <View style={styles.warnBox}>
          <Ionicons name="information-circle-outline" size={14} color={colors.amber} />
          <AppText color={colors.textSoft} style={{ fontSize: 10.5, lineHeight: 17, flex: 1 }}>
            {codeTarget?.role === "owner"
              ? "کد حساب Owner از backend/.env کنترل می‌شود؛ از منوی سرور (گزینهٔ ۱۴) تغییر بده."
              : "کد باید ۶ کاراکتر و فقط حروف انگلیسی بزرگ/اعداد باشد."}
          </AppText>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing.xs,
  },

  /* header */
  headerRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  backButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white04,
  },
  primaryButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.70)",
    backgroundColor: colors.white,
  },
  primaryBadge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black,
  },

  /* panels */
  panelPad: { padding: 16 },
  searchPanel: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    minHeight: 46,
    marginBottom: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white03,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 13.5,
    textAlign: "right",
    writingDirection: "rtl",
    paddingVertical: 0,
  },
  badge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white04,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  /* rows */
  userRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  userRowDivider: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  identityRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  nameRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  roleBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  roleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  roleSelect: {
    flex: 1,
    minHeight: 38,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white03,
  },
  controlRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: colors.white03,
  },
  statusPill: {
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  codeChip: {
    height: 28,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.white10,
    backgroundColor: colors.white05,
  },

  /* create panel */
  createdBox: { alignItems: "center", gap: 8 },
  createdIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.successLine,
    backgroundColor: colors.successSoft,
  },
  credentialCard: {
    width: "100%",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.amberLine,
    backgroundColor: colors.amberSoft,
  },
  credentialRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  createdActions: {
    flexDirection: "row-reverse",
    gap: 8,
    width: "100%",
  },
  ghostButton: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.white12,
    backgroundColor: colors.white03,
  },

  /* feedback */
  errorBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 16,
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 40,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  note: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 6,
    paddingTop: 16,
    paddingHorizontal: 4,
  },

  /* sheet */
  codeHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingBottom: 8,
  },
  warnBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.amberLine,
    backgroundColor: colors.amberSoft,
  },
});
