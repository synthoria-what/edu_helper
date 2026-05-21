export function normalizeVideoUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return getEmbedVideoUrl(trimmed);
}

export function getEmbedVideoUrl(value: string): string {
  try {
    const url = new URL(value);
    const youtubeEmbedUrl = getYoutubeEmbedUrl(url);
    if (youtubeEmbedUrl) return youtubeEmbedUrl;

    const rutubeEmbedUrl = getRutubeEmbedUrl(url);
    if (rutubeEmbedUrl) return rutubeEmbedUrl;
  } catch {
    return value;
  }

  return value;
}

function getYoutubeEmbedUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (!["youtu.be", "youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
    return null;
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const videoId =
    host === "youtu.be"
      ? pathParts[0]
      : url.pathname === "/watch"
        ? url.searchParams.get("v")
        : ["shorts", "embed", "live", "v"].includes(pathParts[0])
          ? pathParts[1]
          : null;

  return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
}

function getRutubeEmbedUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "rutube.ru" && host !== "m.rutube.ru") {
    return null;
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  if (pathParts[0] === "play" && pathParts[1] === "embed" && pathParts[2]) {
    return `https://rutube.ru/play/embed/${pathParts[2]}`;
  }
  if (pathParts[0] === "video" && pathParts[1]) {
    return `https://rutube.ru/play/embed/${pathParts[1]}`;
  }

  return null;
}
