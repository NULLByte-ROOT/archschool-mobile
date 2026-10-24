import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

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
import { EmptyState, SectionTitle, SkeletonRows, SolidCard } from "@/components/cards";
import { Field } from "@/components/Field";
import { Header } from "@/components/Header";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import {
  AppText,
  Avatar,
  Divider,
  Pill,
  type IconName,
  type PillTone,
} from "@/components/ui";
import { faDate } from "@/lib/format";
import {
  ROLE_DESCRIPTION,
  isOwner,
  roleColor,
  roleLabel,
} from "@/lib/roles";
import { useAuthStore } from "@/store/auth";
import { colors, fonts, radius, screenGutter, spacing } from "@/theme/tokens";

const ASSIGNABLE_ROLES: Role[] = ["admin", "friend", "member"];
const OWNER_ROLE: Role = "owner";
const CODE_HINT = "دقیقاً ۶ کاراکتر انگلیسی بزرگ یا رقم";

function roleTone(role: Role): PillTone {
  return roleColor(role) as PillTone;
}

function RoleOption({
  role,
  selected,
  disabled = false,
  onSelect,
}: {
  role: Role;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      disabled={disabled}
      style={[
        styles.roleOption,
        selected && styles.roleOptionActive,
        disabled && { opacity: 0.45 },
      ]}
    >
      <View style={styles.roleOptionTop}>
        <Pill label={roleLabel(role)} tone={roleTone(role)} />
        <Ionicons
          name={selected ? "radio-button-on" : "radio-button-off"}
          size={16}
          color={selected ? colors.amber : colors.faint}
        />
      </View>
      <AppText variant="caption" color={colors.muted} style={{ fontSize: 10.5, lineHeight: 16 }}>
        {ROLE_DESCRIPTION[role]}
      </AppText>
    </Pressable>
  );
}

function ManageRow({
  icon,
  label,
  hint,
  tone = colors.text,
  onPress,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  tone?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.manageRow, disabled && { opacity: 0.45 }]}
    >
      <View style={styles.manageIcon}>
        <Ionicons name={icon} size={16} color={tone} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText variant="label" color={tone} style={{ fontFamily: fonts.semibold }}>
          {label}
        </AppText>
        {hint ? (
          <AppText variant="caption" color={colors.faint} style={{ fontSize: 10.5, lineHeight: 16 }}>
            {hint}
          </AppText>
        ) : null}
      </View>
      {onPress ? <Ionicons name="chevron-back" size={14} color={colors.faint} /> : null}
    </Pressable>
  );
}

export default function UsersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useAuthStore((state) => state.user);
  const owner = isOwner(me);

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [savingRole, setSavingRole] = useState<Role | null>(null);
  const [savingActive, setSavingActive] = useState(false);

  const [codeTarget, setCodeTarget] = useState<User | null>(null);
  const [codeValue, setCodeValue] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [savingCode, setSavingCode] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newRole, setNewRole] = useState<Role>("member");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<User | null>(null);

  const query = useQuery({ queryKey: qk.users, queryFn: fetchUsers });

  const users = useMemo(() => query.data ?? [], [query.data]);
  const selected = users.find((person) => person.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (person) =>
        person.username.toLowerCase().includes(needle) ||
        (person.code ?? "").toLowerCase().includes(needle) ||
        roleLabel(person.role).toLowerCase().includes(needle)
    );
  }, [users, search]);

  const activeCount = users.filter((person) => person.is_active).length;

  const refresh = () => {
    void query.refetch();
  };

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
      setSavingRole(role);
      void (async () => {
        try {
          const updated = await updateUser(target.id, { role });
          patchLocalUser(updated);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => undefined
          );
        } catch (error) {
          Alert.alert(
            "تغییر نقش",
            error instanceof ApiError ? error.message : "تغییر نقش انجام نشد."
          );
        } finally {
          setSavingRole(null);
        }
      })();
    };

    if (role === OWNER_ROLE) {
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
    if (savingActive) return;
    const next = !target.is_active;
    setSavingActive(true);
    void (async () => {
      try {
        const updated = await updateUser(target.id, { is_active: next });
        patchLocalUser(updated);
        void Haptics.selectionAsync().catch(() => undefined);
      } catch (error) {
        Alert.alert(
          "وضعیت حساب",
          error instanceof ApiError ? error.message : "تغییر وضعیت انجام نشد."
        );
      } finally {
        setSavingActive(false);
      }
    })();
  };

  const openCodeSheet = (target: User) => {
    setSelectedId(null);
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
      } catch (error) {
        setCodeError(
          error instanceof ApiError ? error.message : "تغییر کد انجام نشد."
        );
      } finally {
        setSavingCode(false);
      }
    })();
  };

  const confirmDelete = (target: User) => {
    Alert.alert(
      "حذف حساب",
      `حساب «${target.username}» و همهٔ دسترسی‌هایش حذف می‌شود. این کار برگشت‌پذیر نیست.`,
      [
        { text: "انصراف", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => {
            setSelectedId(null);
            void (async () => {
              try {
                await deleteUser(target.id);
                await queryClient.invalidateQueries({ queryKey: qk.users });
                void queryClient.invalidateQueries({ queryKey: qk.team });
                void queryClient.invalidateQueries({ queryKey: qk.leaderboard });
              } catch (error) {
                Alert.alert(
                  "حذف",
                  error instanceof ApiError ? error.message : "حذف حساب انجام نشد."
                );
              }
            })();
          },
        },
      ]
    );
  };

  const resetCreateForm = () => {
    setNewUsername("");
    setNewCode("");
    setNewRole("member");
    setCreateError(null);
    setCreated(null);
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const submitCreate = () => {
    const username = newUsername.trim();
    if (username.length < 2) {
      setCreateError("نام کاربری باید حداقل ۲ کاراکتر باشد.");
      return;
    }
    const code = newCode.trim().toUpperCase();
    if (code && !/^[A-Z0-9]{6}$/.test(code)) {
      setCreateError(CODE_HINT);
      return;
    }
    setCreating(true);
    setCreateError(null);
    void (async () => {
      try {
        const user = await createUser({
          username,
          code: code || undefined,
          role: newRole,
        });
        setCreated(user);
        setNewUsername("");
        setNewCode("");
        void queryClient.invalidateQueries({ queryKey: qk.users });
        void queryClient.invalidateQueries({ queryKey: qk.team });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined
        );
      } catch (error) {
        setCreateError(
          error instanceof ApiError ? error.message : "ساخت حساب انجام نشد."
        );
      } finally {
        setCreating(false);
      }
    })();
  };

  const shareCredentials = (user: User) => {
    void Share.share({
      message: `ورود به ArchSchool\nنام کاربری: ${user.username}\nکد دسترسی: ${user.code ?? "—"}\nنشانی: https://archschool.vidxsepehr.ir`,
    }).catch(() => undefined);
  };

  const canTouchOwner = owner;
  const roleOptions = owner ? [OWNER_ROLE, ...ASSIGNABLE_ROLES] : ASSIGNABLE_ROLES;

  return (
    <Screen edges={["top"]}>
      <Header
        title="مدیریت اعضا"
        subtitle={`${activeCount} فعال از ${users.length} حساب`}
        onBack={() => router.back()}
        actions={
          <Pressable
            onPress={openCreate}
            style={styles.addButton}
            hitSlop={8}
            accessibilityLabel="افزودن عضو"
          >
            <Ionicons name="person-add-outline" size={19} color={colors.amber} />
          </Pressable>
        }
      />

      <View style={styles.searchWrap}>
        <Field
          value={search}
          onChangeText={setSearch}
          placeholder="جست‌وجوی نام، کد یا نقش…"
          icon="search-outline"
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={refresh}
            tintColor={colors.amber}
            colors={[colors.amber]}
            progressBackgroundColor={colors.panel}
          />
        }
      >
        {query.isLoading ? (
          <SkeletonRows count={5} height={68} />
        ) : query.isError && !query.data ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="فهرست اعضا باز نشد"
            hint={
              query.error instanceof ApiError
                ? query.error.message
                : "اتصال اینترنت را بررسی کنید."
            }
            actionLabel="تلاش دوباره"
            onAction={refresh}
          />
        ) : filtered.length === 0 ? (
          <SolidCard>
            <EmptyState
              compact
              icon="people-outline"
              title={search.trim() ? "عضوی پیدا نشد" : "هنوز عضوی نیست"}
              hint={search.trim() ? "عبارت دیگری را امتحان کن." : "با دکمهٔ بالا اولین عضو را بساز."}
              actionLabel={search.trim() ? undefined : "افزودن عضو"}
              onAction={search.trim() ? undefined : openCreate}
            />
          </SolidCard>
        ) : (
          <>
            <SectionTitle title="اعضای تیم" hint={`${filtered.length} نتیجه`} />
            <SolidCard style={{ paddingHorizontal: spacing.md }}>
              {filtered.map((person, index) => {
                const self = person.id === me?.id;
                return (
                  <View key={person.id}>
                    {index > 0 ? <Divider /> : null}
                    <Pressable
                      onPress={() => setSelectedId(person.id)}
                      style={({ pressed }) => [
                        styles.userRow,
                        !person.is_active && { opacity: 0.6 },
                        pressed && { opacity: 0.82 },
                      ]}
                    >
                      <Avatar
                        name={person.username}
                        uri={person.avatar_url}
                        size="sm"
                        ring={self}
                      />
                      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                        <View style={styles.userNameRow}>
                          <AppText
                            variant="label"
                            numberOfLines={1}
                            style={{ fontFamily: fonts.semibold, flexShrink: 1 }}
                          >
                            {person.username}
                          </AppText>
                          {self ? <Pill label="تو" tone="amber" /> : null}
                          {!person.is_active ? <Pill label="غیرفعال" tone="red" /> : null}
                        </View>
                        <View style={styles.userMeta}>
                          <Pill label={roleLabel(person.role)} tone={roleTone(person.role)} />
                          <AppText variant="caption" color={colors.faint} ltr style={{ fontSize: 10.5 }}>
                            {person.code ?? "—"}
                          </AppText>
                        </View>
                      </View>
                      <Ionicons name="chevron-back" size={14} color={colors.faint} />
                    </Pressable>
                  </View>
                );
              })}
            </SolidCard>
          </>
        )}

        <Animated.View entering={FadeInDown.duration(420)} style={styles.note}>
          <Ionicons name="shield-half-outline" size={13} color={colors.faint} />
          <AppText variant="caption" color={colors.faint} style={{ flex: 1 }}>
            فقط Owner می‌تواند نقش Owner بسازد یا کد دسترسی اعضا را تغییر دهد. ادمین‌ها
            تکالیف، گفتگو و نقش‌های عضو/فرند/ادمین را مدیریت می‌کنند.
          </AppText>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Manage member ------------------------------------------------ */}
      <Sheet
        visible={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected?.username ?? "عضو"}
        subtitle={selected ? `عضویت از ${faDate(selected.created_at, "dayMonth")}` : undefined}
      >
        {selected ? (
          <>
            <View style={styles.manageHead}>
              <Avatar name={selected.username} uri={selected.avatar_url} size="lg" ring />
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="subtitle">{selected.username}</AppText>
                <View style={styles.pillRow}>
                  <Pill label={roleLabel(selected.role)} tone={roleTone(selected.role)} />
                  <Pill
                    label={selected.is_active ? "فعال" : "غیرفعال"}
                    tone={selected.is_active ? "teal" : "red"}
                  />
                </View>
                <View style={styles.codeLine}>
                  <Ionicons name="key-outline" size={12} color={colors.faint} />
                  <AppText variant="caption" color={colors.muted} ltr style={{ fontFamily: fonts.medium, letterSpacing: 2 }}>
                    {selected.code ?? "—"}
                  </AppText>
                  {owner ? (
                    <Pressable onPress={() => openCodeSheet(selected)} hitSlop={8}>
                      <AppText variant="caption" color={colors.amber}>
                        تغییر
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>

            {selected.role === "owner" && !owner ? (
              <View style={styles.warnBox}>
                <Ionicons name="lock-closed-outline" size={14} color={colors.amber} />
                <AppText variant="caption" color={colors.muted} style={{ flex: 1 }}>
                  این حساب Owner است؛ فقط Owner می‌تواند نقش، کد یا وضعیت آن را تغییر دهد.
                </AppText>
              </View>
            ) : null}

            <View style={styles.sectionGap}>
              <AppText variant="label" color={colors.muted}>
                نقش و دسترسی
              </AppText>
              <View style={styles.roleGrid}>
                {roleOptions.map((role) => (
                  <RoleOption
                    key={role}
                    role={role}
                    selected={selected.role === role}
                    disabled={
                      savingRole !== null ||
                      (role === "owner" && !owner) ||
                      (selected.role === "owner" && !canTouchOwner) ||
                      selected.id === me?.id
                    }
                    onSelect={() => changeRole(selected, role)}
                  />
                ))}
              </View>
              {selected.id === me?.id ? (
                <AppText variant="caption" color={colors.faint}>
                  نقش حساب خودت را از این صفحه تغییر نده؛ برای جلوگیری از قفل‌شدن دسترسی.
                </AppText>
              ) : null}
            </View>

            <Divider />

            <View style={styles.switchRow}>
              <View style={{ flex: 1, gap: 1 }}>
                <AppText variant="label" style={{ fontFamily: fonts.semibold }}>
                  حساب فعال
                </AppText>
                <AppText variant="caption" color={colors.faint}>
                  حساب غیرفعال نمی‌تواند وارد شود اما داده‌هایش می‌ماند.
                </AppText>
              </View>
              <Switch
                value={selected.is_active}
                onValueChange={() => toggleActive(selected)}
                disabled={
                  savingActive ||
                  selected.id === me?.id ||
                  (selected.role === "owner" && !canTouchOwner)
                }
                trackColor={{ false: "rgba(255,255,255,0.12)", true: colors.teal }}
                thumbColor={selected.is_active ? colors.ink : colors.muted}
                ios_backgroundColor="rgba(255,255,255,0.12)"
              />
            </View>

            <Divider />

            {owner ? (
              <ManageRow
                icon="key-outline"
                label="تغییر کد دسترسی"
                hint={
                  selected.role === "owner"
                    ? "کد حساب Owner از backend/.env کنترل می‌شود."
                    : "کد جدید ۶ کاراکتری بساز و به عضو بده."
                }
                onPress={() => openCodeSheet(selected)}
              />
            ) : null}

            <ManageRow
              icon="share-social-outline"
              label="هم‌رسانی اطلاعات ورود"
              hint="نام کاربری و کد دسترسی"
              onPress={() => shareCredentials(selected)}
            />

            <Divider />

            <ManageRow
              icon="trash-outline"
              label="حذف حساب"
              hint={
                selected.id === me?.id
                  ? "حساب خودت را نمی‌توانی حذف کنی."
                  : "حذف کامل حساب و دسترسی‌ها."
              }
              tone={colors.red}
              disabled={selected.id === me?.id || (selected.role === "owner" && !owner)}
              onPress={() => confirmDelete(selected)}
            />
          </>
        ) : null}
      </Sheet>

      {/* Owner: change access code ------------------------------------ */}
      <Sheet
        visible={codeTarget !== null}
        onClose={() => setCodeTarget(null)}
        title="تغییر کد دسترسی"
        subtitle={codeTarget?.username}
        footer={
          <Button
            label="ذخیرهٔ کد"
            icon="key-outline"
            onPress={saveCode}
            loading={savingCode}
          />
        }
      >
        <View style={styles.codeHead}>
          <Avatar name={codeTarget?.username} uri={codeTarget?.avatar_url} size="sm" />
          <View style={{ flex: 1, gap: 1 }}>
            <AppText variant="label" style={{ fontFamily: fonts.semibold }}>
              {codeTarget?.username}
            </AppText>
            <AppText variant="caption" color={colors.faint} ltr>
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

        {codeTarget?.role === "owner" ? (
          <View style={styles.warnBox}>
            <Ionicons name="information-circle-outline" size={14} color={colors.amber} />
            <AppText variant="caption" color={colors.muted} style={{ flex: 1 }}>
              اگر کد حساب Owner از طریق backend/.env تنظیم شده باشد، تغییر از اینجا رد
              می‌شود؛ از منوی سرور (گزینهٔ ۱۴) استفاده کن.
            </AppText>
          </View>
        ) : null}
      </Sheet>

      {/* Create member ------------------------------------------------ */}
      <Sheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="افزودن عضو"
        subtitle="نام کاربری و نقش را انتخاب کن"
        footer={
          created ? (
            <Button
              label="بستن"
              icon="checkmark"
              onPress={() => setCreateOpen(false)}
            />
          ) : (
            <Button
              label="ساخت حساب"
              icon="person-add-outline"
              onPress={submitCreate}
              loading={creating}
            />
          )
        }
      >
        {created ? (
          <View style={styles.createdBox}>
            <View style={styles.createdIcon}>
              <Ionicons name="checkmark-circle" size={30} color={colors.teal} />
            </View>
            <AppText variant="subtitle" align="center">
              حساب ساخته شد
            </AppText>
            <AppText variant="caption" color={colors.muted} align="center">
              این اطلاعات را به عضو بده؛ کد دسترسی دیگر نمایش داده نمی‌شود مگر از همین صفحه.
            </AppText>
            <View style={styles.credentialCard}>
              <View style={styles.credentialRow}>
                <AppText variant="caption" color={colors.muted}>
                  نام کاربری
                </AppText>
                <AppText variant="label" ltr style={{ fontFamily: fonts.semibold }}>
                  {created.username}
                </AppText>
              </View>
              <Divider />
              <View style={styles.credentialRow}>
                <AppText variant="caption" color={colors.muted}>
                  کد دسترسی
                </AppText>
                <AppText
                  variant="numberSm"
                  color={colors.amber}
                  ltr
                  style={{ letterSpacing: 5, fontSize: 22 }}
                >
                  {created.code ?? "—"}
                </AppText>
              </View>
            </View>
            <Button
              label="هم‌رسانی اطلاعات ورود"
              icon="share-social-outline"
              variant="ghost"
              onPress={() => shareCredentials(created)}
            />
            <Button
              label="افزودن عضو دیگر"
              icon="add"
              variant="ghost"
              onPress={resetCreateForm}
            />
          </View>
        ) : (
          <>
            <Field
              label="نام کاربری"
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="مثلاً sara"
              maxLength={50}
            />
            <Field
              label="کد دسترسی (اختیاری)"
              value={newCode}
              onChangeText={(value) => setNewCode(value.toUpperCase())}
              placeholder="خالی بگذار تا خودکار ساخته شود"
              hint={CODE_HINT}
              ltr
              maxLength={6}
              autoCapitalize="characters"
            />

            <View style={styles.sectionGap}>
              <AppText variant="label" color={colors.muted}>
                نقش
              </AppText>
              <View style={styles.roleGrid}>
                {roleOptions.map((role) => (
                  <RoleOption
                    key={role}
                    role={role}
                    selected={newRole === role}
                    onSelect={() => setNewRole(role)}
                  />
                ))}
              </View>
            </View>

            {createError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={14} color={colors.red} />
                <AppText variant="caption" color={colors.red} style={{ flex: 1 }}>
                  {createError}
                </AppText>
              </View>
            ) : null}
          </>
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenGutter, paddingBottom: 40 },
  searchWrap: { paddingHorizontal: screenGutter, paddingBottom: spacing.sm },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberLine,
  },
  userRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
  },
  userNameRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  userMeta: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  note: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 5,
    paddingTop: spacing.lg,
  },
  manageHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  pillRow: {
    flexDirection: "row-reverse",
    gap: 5,
    flexWrap: "wrap",
  },
  codeLine: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
  },
  warnBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberLine,
  },
  errorBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.redSoft,
    borderWidth: 1,
    borderColor: "rgba(242,104,107,0.3)",
  },
  sectionGap: { gap: spacing.xs, paddingTop: spacing.xs },
  roleGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  roleOption: {
    width: "48.8%",
    gap: 5,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  roleOptionActive: {
    borderColor: colors.amberLine,
    backgroundColor: colors.amberSoft,
  },
  roleOptionTop: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  switchRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  manageRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  manageIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: colors.line,
  },
  codeHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  createdBox: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  createdIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: "rgba(79,209,181,0.32)",
  },
  credentialCard: {
    width: "100%",
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.amberLine,
    backgroundColor: colors.amberSoft,
  },
  credentialRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
});
