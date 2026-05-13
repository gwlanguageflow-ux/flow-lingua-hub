type AuthSettings = {
  external?: {
    google?: boolean;
  };
};

let googleAuthEnabled: Promise<boolean> | null = null;

export function isGoogleAuthEnabled() {
  if (!googleAuthEnabled) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey =
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      googleAuthEnabled = Promise.resolve(false);
      return googleAuthEnabled;
    }

    googleAuthEnabled = fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: {
        apikey: supabaseKey,
      },
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const settings = (await response.json()) as AuthSettings;
        return settings.external?.google === true;
      })
      .catch(() => false);
  }

  return googleAuthEnabled;
}
