import { Redirect } from "expo-router";

import { useAuthStore } from "@/store/auth";

export default function Index() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  if (!token) return <Redirect href="/onboarding" />;
  if (user?.must_set_password) return <Redirect href="/onboarding/setup-account" />;
  return <Redirect href="/(tabs)/home" />;
}
