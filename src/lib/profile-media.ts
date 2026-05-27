import directorEloizaImage from "@/assets/director-eloiza.jpg";

type ProfileMedia = {
  avatar_url?: string | null;
  email?: string | null;
  full_name?: string | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isDirectorEloizaProfile(profile: ProfileMedia) {
  const name = normalize(profile.full_name);
  const email = normalize(profile.email);
  return email === "gwlanguageflow@gmail.com" || name.includes("eloiza gramacho");
}

export function getProfileAvatarUrl(profile: ProfileMedia) {
  if (profile.avatar_url?.trim()) return profile.avatar_url;
  if (isDirectorEloizaProfile(profile)) return directorEloizaImage;
  return null;
}

export function getProfileBannerUrl(profile: ProfileMedia) {
  return getProfileAvatarUrl(profile);
}
