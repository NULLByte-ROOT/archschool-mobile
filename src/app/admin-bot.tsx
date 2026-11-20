import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiError,
  AvailableModelItem,
  fetchAvailableModels,
  getBotSettings,
  resetBotPrompts,
  testBot,
  updateBotSettings,
} from "@/api/client";
import { Button } from "@/components/Button";
import { Header } from "@/components/Header";
import { Screen } from "@/components/Screen";
import { AppText } from "@/components/ui";
import { Kicker, MonoLabel, Panel } from "@/components/webui";
import { isOwner, isStaff } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";
import {
  colors,
  fonts,
  radius,
  screenGutter,
  spacing,
} from "@/theme/tokens";

const AI_PROVIDERS = [
  { id: "openrouter", label: "OpenRouter (پیش‌فرض)", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-4o-mini" },
  { id: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", defaultModel: "gemini-3.1-flash-lite" },
  { id: "groq", label: "Groq (فوق‌سریع)", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "openai/gpt-oss-120b" },
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" },
  { id: "xai", label: "xAI (Grok)", baseUrl: "https://api.x.ai/v1", defaultModel: "grok-2" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini" },
] as const;

export default function AdminBotScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const owner = isOwner(user);
  const staff = isStaff(user);

  const [activeTab, setActiveTab] = useState<"prompt" | "ai" | "telegram">("prompt");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Tab 1: Prompts
  const [systemPrompt, setSystemPrompt] = useState("");
  const [personaAnchor, setPersonaAnchor] = useState("");
  const [followupAnchor, setFollowupAnchor] = useState("");
  const [temperature, setTemperature] = useState("0.85");
  const [maxTokens, setMaxTokens] = useState("600");

  // Tab 2: AI Engine
  const [aiProvider, setAiProvider] = useState("openrouter");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("https://openrouter.ai/api/v1");
  const [aiModel, setAiModel] = useState("openai/gpt-4o-mini");
  const [showKey, setShowKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<AvailableModelItem[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  // Tab 3: Telegram
  const [botToken, setBotToken] = useState("");
  const [groupId, setGroupId] = useState("");
  const [botEnabled, setBotEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const s = await getBotSettings();
        if (active) {
          setBotToken(s.bot_token || "");
          setGroupId(s.group_id || "");
          setAiProvider(s.ai_provider || "openrouter");
          setAiApiKey(s.ai_api_key || "");
          setAiBaseUrl(s.ai_base_url || "https://openrouter.ai/api/v1");
          setAiModel(s.ai_model || "openai/gpt-4o-mini");
          setSystemPrompt(s.ai_system_prompt || "");
          setPersonaAnchor(s.ai_persona_anchor || "");
          setFollowupAnchor(s.ai_followup_anchor || "");
          setTemperature(String(s.ai_temperature ?? 0.85));
          setMaxTokens(String(s.ai_max_tokens ?? 600));
          setBotEnabled(s.bot_enabled ?? true);
        }
      } catch {
        // fallback
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleSelectProvider = (prov: typeof AI_PROVIDERS[number]) => {
    setAiProvider(prov.id);
    if (prov.baseUrl) setAiBaseUrl(prov.baseUrl);
    if (prov.defaultModel) setAiModel(prov.defaultModel);
    setAvailableModels([]);
  };

  const handleFetchModels = async () => {
    const k = aiApiKey.trim();
    if (!k) {
      Alert.alert("کلید خالی است", "ابتدا کلید دسترسی هوش مصنوعی را وارد کنید.");
      return;
    }
    setFetchingModels(true);
    try {
      const res = await fetchAvailableModels({
        api_key: k,
        base_url: aiBaseUrl.trim(),
        provider: aiProvider,
      });
      if (res.ok && res.models && res.models.length > 0) {
        setAvailableModels(res.models);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      } else {
        Alert.alert("عدم دریافت", res.error || "مدلی از ارائه‌دهنده دریافت نشد.");
      }
    } catch (e: any) {
      Alert.alert("خطا", e.message || "خطا در دریافت لیست مدل‌ها.");
    } finally {
      setFetchingModels(false);
    }
  };

  const handleCopyPrompt = async () => {
    await Clipboard.setStringAsync(systemPrompt);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    Alert.alert("کپی شد", "پرامپت سیستمی در کلیپ‌بورد کپی شد.");
  };

  const handleResetPrompt = () => {
    Alert.alert(
      "بازنشانی پرامپت",
      "آیا از بازنشانی پرامپت‌ها و لنگرها به تنظیمات اولیه اطمینان دارید؟",
      [
        { text: "انصراف", style: "cancel" },
        {
          text: "بازنشانی",
          style: "destructive",
          onPress: async () => {
            setResetting(true);
            try {
              const res = await resetBotPrompts();
              setSystemPrompt(res.settings.ai_system_prompt || "");
              setPersonaAnchor(res.settings.ai_persona_anchor || "");
              setFollowupAnchor(res.settings.ai_followup_anchor || "");
              setTemperature(String(res.settings.ai_temperature ?? 0.7));
              setMaxTokens(String(res.settings.ai_max_tokens ?? 1000));
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
              setFeedback({ success: true, message: "پرامپت با موفقیت به حالت اولیه بازنشانی شد." });
            } catch (err: any) {
              setFeedback({ success: false, message: err.message || "خطا در بازنشانی پرامپت" });
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await updateBotSettings({
        bot_token: botToken.trim(),
        group_id: groupId.trim(),
        ai_provider: aiProvider,
        ai_api_key: aiApiKey.trim(),
        ai_base_url: aiBaseUrl.trim(),
        ai_model: aiModel.trim(),
        ai_system_prompt: systemPrompt,
        ai_persona_anchor: personaAnchor,
        ai_followup_anchor: followupAnchor,
        ai_temperature: parseFloat(temperature) || 0.85,
        ai_max_tokens: parseInt(maxTokens, 10) || 600,
        bot_enabled: botEnabled,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setFeedback({ success: true, message: "تنظیمات پرامپت، مدل هوش مصنوعی و ربات با موفقیت ذخیره شد! ✅" });
    } catch (err: any) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      const msg = err instanceof ApiError ? err.message : "خطا در ذخیره تنظیمات";
      setFeedback({ success: false, message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const res = await testBot("پیام تستی اپلیکیشن موبایل ArchSchool");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      const groupNote = res.group_message_sent ? "پیام آزمایشی به گروه ارسال شد! ✅" : "(آیدی گروه خالی بود یا ارسال نشد)";
      setFeedback({
        success: true,
        message: `ربات @${res.bot_username || "ناشناس"} آنلاین است! هوش مصنوعی: ${res.ai_status || "نامشخص"}. ${groupNote}`,
      });
    } catch (err: any) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      const msg = err instanceof ApiError ? err.message : "خطا در ارتباط با ربات تلگرام یا مدل هوش مصنوعی";
      setFeedback({ success: false, message: msg });
    } finally {
      setTesting(false);
    }
  };

  if (!staff && !owner) {
    return (
      <Screen>
        <Header title="هوش مصنوعی" onBack={() => router.back()} />
        <View style={styles.centerContainer}>
          <Ionicons name="lock-closed" size={48} color={colors.danger} />
          <AppText variant="title" style={{ marginTop: 16 }}>دسترسی محدود</AppText>
          <AppText color={colors.faint} style={{ marginTop: 8 }}>این بخش مخصوص مدیران کلاس است.</AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="هوش مصنوعی و ربات تلگرام"
        subtitle="مدیریت پرامپت، شخصیت مدل، API و ربات"
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 80 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Segmented Tab Bar */}
          <View style={styles.tabBar}>
            <Pressable
              onPress={() => setActiveTab("prompt")}
              style={[styles.tabItem, activeTab === "prompt" && styles.tabItemActive]}
            >
              <Ionicons
                name="sparkles"
                size={14}
                color={activeTab === "prompt" ? colors.white : colors.faint}
              />
              <AppText
                style={[
                  styles.tabText,
                  activeTab === "prompt" && styles.tabTextActive,
                ]}
              >
                پرامپت و لحن
              </AppText>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("ai")}
              style={[styles.tabItem, activeTab === "ai" && styles.tabItemActive]}
            >
              <Ionicons
                name="hardware-chip-outline"
                size={14}
                color={activeTab === "ai" ? colors.white : colors.faint}
              />
              <AppText
                style={[
                  styles.tabText,
                  activeTab === "ai" && styles.tabTextActive,
                ]}
              >
                مدل و API
              </AppText>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("telegram")}
              style={[styles.tabItem, activeTab === "telegram" && styles.tabItemActive]}
            >
              <Ionicons
                name="paper-plane-outline"
                size={14}
                color={activeTab === "telegram" ? colors.white : colors.faint}
              />
              <AppText
                style={[
                  styles.tabText,
                  activeTab === "telegram" && styles.tabTextActive,
                ]}
              >
                ربات تلگرام
              </AppText>
            </Pressable>
          </View>

          {/* Feedback banner */}
          {feedback ? (
            <View
              style={[
                styles.feedbackBox,
                {
                  backgroundColor: feedback.success
                    ? "rgba(16, 185, 129, 0.12)"
                    : "rgba(239, 68, 68, 0.12)",
                  borderColor: feedback.success
                    ? "rgba(16, 185, 129, 0.3)"
                    : "rgba(239, 68, 68, 0.3)",
                },
              ]}
            >
              <Ionicons
                name={feedback.success ? "checkmark-circle" : "alert-circle"}
                size={16}
                color={feedback.success ? colors.emerald : colors.danger}
              />
              <AppText
                color={feedback.success ? colors.emerald : colors.danger}
                style={{ fontSize: 11.5, flex: 1, lineHeight: 18 }}
              >
                {feedback.message}
              </AppText>
            </View>
          ) : null}

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.accent} />
              <AppText color={colors.faint} style={{ marginTop: 12, fontSize: 12 }}>
                در حال بارگذاری تنظیمات...
              </AppText>
            </View>
          ) : null}

          {!loading && activeTab === "prompt" && (
            <View>
              <Kicker text="system instruction" dot style={{ marginBottom: 8 }} />
              <Panel corners contentStyle={styles.cardPad} style={{ marginBottom: 16, overflow: "hidden" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  <MonoLabel>// SYSTEM INSTRUCTION</MonoLabel>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <Pressable onPress={handleCopyPrompt} style={styles.actionBtn}>
                      <Ionicons name="copy-outline" size={12} color={colors.accent} />
                      <AppText variant="caption" color={colors.accent} style={{ fontSize: 11 }}>کپی</AppText>
                    </Pressable>
                    <Pressable onPress={handleResetPrompt} disabled={resetting} style={[styles.actionBtn, { borderColor: "rgba(248,113,113,0.3)" }]}>
                      <Ionicons name="refresh-outline" size={12} color={colors.danger} />
                      <AppText variant="caption" color={colors.danger} style={{ fontSize: 11 }}>بازنشانی</AppText>
                    </Pressable>
                  </View>
                </View>

                <AppText color={colors.faint} style={{ fontSize: 11.5, lineHeight: 18, marginBottom: 8 }}>
                  دستورالعمل سیستمی، قوانین پاسخگویی و نقش هوش مصنوعی را در این بخش مشخص کنید (در صورت خالی بودن، مدل با رفتار استاندارد خود پاسخ می‌دهد):
                </AppText>

                <TextInput
                  value={systemPrompt}
                  onChangeText={setSystemPrompt}
                  multiline
                  numberOfLines={14}
                  style={[styles.textInput, styles.promptArea]}
                  placeholder="دستورالعمل سیستمی هوش مصنوعی..."
                  placeholderTextColor={colors.faint}
                  textAlignVertical="top"
                />
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  <AppText color={colors.faint} style={{ fontSize: 10 }}>
                    {systemPrompt.length} کاراکتر
                  </AppText>
                  <AppText color={colors.faint} style={{ fontSize: 10 }}>
                    تغییرات بلافاصله پس از ذخیره فعال می‌شود
                  </AppText>
                </View>
              </Panel>

              <Kicker text="persona anchors" dot style={{ marginBottom: 8 }} />
              <Panel corners contentStyle={styles.cardPad} style={{ marginBottom: 16 }}>
                <MonoLabel style={{ marginBottom: 8 }}>// PERSONA ANCHOR</MonoLabel>
                <AppText color={colors.faint} style={{ fontSize: 11.5, lineHeight: 18, marginBottom: 8 }}>
                  دستور سیستمی که پیش از پیام کاربر جهت حفظ پیوستگی لحن و پاسخگویی تزریق می‌شود (اختیاری):
                </AppText>
                <TextInput
                  value={personaAnchor}
                  onChangeText={setPersonaAnchor}
                  multiline
                  numberOfLines={4}
                  style={[styles.textInput, { minHeight: 70 }]}
                  placeholder="دستور لنگر لحن و رفتار..."
                  placeholderTextColor={colors.faint}
                  textAlignVertical="top"
                />

                <MonoLabel style={{ marginTop: 14, marginBottom: 8 }}>// FOLLOW-UP ANCHOR</MonoLabel>
                <AppText color={colors.faint} style={{ fontSize: 11.5, lineHeight: 18, marginBottom: 8 }}>
                  دستورالعملی که پس از فراخوانی ابزارها جهت قالب‌بندی و ارائه مناسب اطلاعات اعمال می‌شود (اختیاری):
                </AppText>
                <TextInput
                  value={followupAnchor}
                  onChangeText={setFollowupAnchor}
                  multiline
                  numberOfLines={4}
                  style={[styles.textInput, { minHeight: 70 }]}
                  placeholder="دستور نحوه ارائه خروجی ابزارها..."
                  placeholderTextColor={colors.faint}
                  textAlignVertical="top"
                />
              </Panel>
            </View>
          )}

          {!loading && activeTab === "ai" && (
            <View>
              <Kicker text="ai provider selection" dot style={{ marginBottom: 8 }} />
              <Panel corners contentStyle={styles.cardPad} style={{ marginBottom: 16 }}>
                <MonoLabel style={{ marginBottom: 8 }}>// PROVIDER</MonoLabel>
                <View style={styles.providerGrid}>
                  {AI_PROVIDERS.map((prov) => {
                    const active = aiProvider === prov.id;
                    return (
                      <Pressable
                        key={prov.id}
                        style={[styles.providerCard, active && styles.providerCardActive]}
                        onPress={() => handleSelectProvider(prov)}
                      >
                        <AppText
                          style={{
                            fontFamily: active ? fonts.bold : fonts.regular,
                            fontSize: 12,
                            color: active ? colors.accent : colors.faint,
                          }}
                        >
                          {prov.label}
                        </AppText>
                        <AppText
                          color={colors.faint}
                          style={{ fontSize: 9.5, marginTop: 2 }}
                          numberOfLines={1}
                        >
                          {prov.defaultModel}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>

                {/* API Key */}
                <View style={[styles.inputGroup, { marginTop: 14 }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <AppText variant="caption" color={colors.muted} style={styles.inputLabel}>
                      کلید دسترسی (API Key)
                    </AppText>
                    <Pressable onPress={() => setShowKey(!showKey)}>
                      <Ionicons name={showKey ? "eye-off-outline" : "eye-outline"} size={16} color={colors.faint} />
                    </Pressable>
                  </View>
                  <TextInput
                    value={aiApiKey}
                    onChangeText={setAiApiKey}
                    secureTextEntry={!showKey}
                    placeholder="sk-or-v1-..."
                    placeholderTextColor={colors.faint}
                    style={[styles.textInput, { fontFamily: fonts.medium }]}
                    textAlign="left"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Base URL */}
                <View style={[styles.inputGroup, { marginTop: 10 }]}>
                  <AppText variant="caption" color={colors.muted} style={styles.inputLabel}>
                    آدرس اندپوینت پایه (Base URL)
                  </AppText>
                  <TextInput
                    value={aiBaseUrl}
                    onChangeText={setAiBaseUrl}
                    placeholder="https://openrouter.ai/api/v1"
                    placeholderTextColor={colors.faint}
                    style={[styles.textInput, { fontFamily: fonts.medium }]}
                    textAlign="left"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Model Name */}
                <View style={[styles.inputGroup, { marginTop: 10 }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <AppText variant="caption" color={colors.muted} style={styles.inputLabel}>
                      نام مدل (Model Name)
                    </AppText>
                    <Pressable
                      onPress={handleFetchModels}
                      disabled={fetchingModels || !aiApiKey.trim()}
                      style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                    >
                      {fetchingModels ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Ionicons name="cloud-download-outline" size={13} color={colors.accent} />
                      )}
                      <AppText variant="caption" color={colors.accent} style={{ fontSize: 11 }}>
                        استعلام مدل‌ها
                      </AppText>
                    </Pressable>
                  </View>
                  <TextInput
                    value={aiModel}
                    onChangeText={setAiModel}
                    placeholder="openai/gpt-4o-mini"
                    placeholderTextColor={colors.faint}
                    style={[styles.textInput, { fontFamily: fonts.medium }]}
                    textAlign="left"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  {availableModels.length > 0 ? (
                    <View style={{ marginTop: 8 }}>
                      <AppText color={colors.faint} style={{ fontSize: 10, marginBottom: 4 }}>
                        مدل‌های فعال اکانت شما (کلیک جهت انتخاب):
                      </AppText>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                        {availableModels.slice(0, 10).map((m) => (
                          <Pressable
                            key={m.id}
                            onPress={() => setAiModel(m.id)}
                            style={[
                              styles.modelChip,
                              aiModel === m.id && styles.modelChipActive,
                            ]}
                          >
                            <AppText
                              style={{
                                fontSize: 10,
                                color: aiModel === m.id ? colors.black : colors.textSoft,
                                fontFamily: fonts.medium,
                              }}
                            >
                              {m.id}
                            </AppText>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              </Panel>

              <Kicker text="hyperparameters" dot style={{ marginBottom: 8 }} />
              <Panel corners contentStyle={styles.cardPad} style={{ marginBottom: 16 }}>
                <MonoLabel style={{ marginBottom: 8 }}>// TEMPERATURE & MAX TOKENS</MonoLabel>

                <View style={styles.inputGroup}>
                  <AppText variant="caption" color={colors.muted} style={styles.inputLabel}>
                    دمای پاسخگویی (Temperature: 0.0 تا 1.5)
                  </AppText>
                  <TextInput
                    value={temperature}
                    onChangeText={setTemperature}
                    keyboardType="numeric"
                    placeholder="0.7"
                    placeholderTextColor={colors.faint}
                    style={[styles.textInput, { fontFamily: fonts.medium }]}
                    textAlign="left"
                  />
                  <AppText color={colors.faint} style={{ fontSize: 10, marginTop: 3 }}>
                    مقدار پیش‌فرض 0.7 تعادل مناسبی بین دقت و تنوع پاسخ‌ها ایجاد می‌کند.
                  </AppText>
                </View>

                <View style={[styles.inputGroup, { marginTop: 10 }]}>
                  <AppText variant="caption" color={colors.muted} style={styles.inputLabel}>
                    حداکثر طول پاسخ (Max Tokens)
                  </AppText>
                  <TextInput
                    value={maxTokens}
                    onChangeText={setMaxTokens}
                    keyboardType="numeric"
                    placeholder="600"
                    placeholderTextColor={colors.faint}
                    style={[styles.textInput, { fontFamily: fonts.medium }]}
                    textAlign="left"
                  />
                </View>
              </Panel>
            </View>
          )}

          {!loading && activeTab === "telegram" && (
            <View>
              <Kicker text="telegram bot connection" dot style={{ marginBottom: 8 }} />
              <Panel corners contentStyle={styles.cardPad} style={{ marginBottom: 16 }}>
                <MonoLabel style={{ marginBottom: 8 }}>// BOT TOKEN & GROUP</MonoLabel>

                <View style={styles.inputGroup}>
                  <AppText variant="caption" color={colors.muted} style={styles.inputLabel}>
                    توکن ربات تلگرام (BotFather Token)
                  </AppText>
                  <TextInput
                    value={botToken}
                    onChangeText={setBotToken}
                    placeholder="123456789:ABCdefGhI..."
                    placeholderTextColor={colors.faint}
                    style={[styles.textInput, { fontFamily: fonts.medium }]}
                    textAlign="left"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={[styles.inputGroup, { marginTop: 10 }]}>
                  <AppText variant="caption" color={colors.muted} style={styles.inputLabel}>
                    شناسه عددی گروه تلگرام (Chat ID)
                  </AppText>
                  <TextInput
                    value={groupId}
                    onChangeText={setGroupId}
                    placeholder="-1001234567890"
                    placeholderTextColor={colors.faint}
                    style={[styles.textInput, { fontFamily: fonts.medium }]}
                    textAlign="left"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
                  <View>
                    <AppText style={{ fontFamily: fonts.bold, fontSize: 13 }}>فعال بودن ربات تلگرام</AppText>
                    <AppText color={colors.faint} style={{ fontSize: 11, marginTop: 2 }}>پاسخ‌گویی به دستورات و پیام‌های دانش‌آموزان</AppText>
                  </View>
                  <Switch
                    value={botEnabled}
                    onValueChange={setBotEnabled}
                    trackColor={{ false: "rgba(255,255,255,0.15)", true: colors.white }}
                    thumbColor={botEnabled ? colors.black : colors.faint}
                  />
                </View>
              </Panel>

              <Kicker text="live connection testing" dot style={{ marginBottom: 8 }} />
              <Panel corners contentStyle={styles.cardPad} style={{ marginBottom: 16 }}>
                <MonoLabel style={{ marginBottom: 8 }}>// INTEGRATION TEST</MonoLabel>
                <AppText color={colors.faint} style={{ fontSize: 11.5, lineHeight: 18, marginBottom: 12 }}>
                  یک پیام تستی برای بررسی اتصال توکن، پاسخ‌دهی موتور هوش مصنوعی و ارسال پیام به گروه تلگرام بفرستید:
                </AppText>
                <Button
                  label={testing ? "در حال اجرای تست..." : "شروع تست اتصال ربات و هوش مصنوعی"}
                  icon={testing ? undefined : "paper-plane-outline"}
                  variant="ghost"
                  disabled={testing}
                  onPress={handleTest}
                />
              </Panel>
            </View>
          )}

          {/* Floating Save Button */}
          <View style={{ marginTop: 12 }}>
            <Button
              label={saving ? "در حال ذخیره..." : "ذخیره تمام تنظیمات"}
              icon={saving ? undefined : "save-outline"}
              variant="primary"
              disabled={saving}
              onPress={handleSave}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: 12,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius.md,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  tabItemActive: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  tabText: {
    fontSize: 11.5,
    fontFamily: fonts.medium,
    color: colors.faint,
  },
  tabTextActive: {
    fontFamily: fonts.bold,
    color: colors.white,
  },
  cardPad: {
    padding: spacing.md,
  },
  inputGroup: {
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.white,
    fontSize: 12.5,
    fontFamily: fonts.regular,
  },
  promptArea: {
    minHeight: 180,
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 19,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  providerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  providerCard: {
    width: "48%",
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  providerCardActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  modelChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  modelChipActive: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  feedbackBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 14,
  },
});
