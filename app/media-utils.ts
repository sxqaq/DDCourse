export type RevocableMediaUrl = {
  url: string;
  text: string;
  revoke: () => void;
};

type UrlApi = Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;

function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

/** Decode subtitle bytes without silently accepting malformed UTF-8. */
export function decodeSubtitleBytes(bytes: Uint8Array): string {
  try {
    return stripBom(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    // TextDecoder's gbk label maps to the WHATWG GBK decoder in browsers/Electron.
    return stripBom(new TextDecoder("gbk").decode(bytes));
  }
}

/** Convert the commonly used SRT subset to browser-native WebVTT. */
export function srtToVtt(source: string): string {
  const normalized = stripBom(source).replace(/\r\n?/g, "\n").trim();
  if (/^WEBVTT(?:\s|$)/i.test(normalized)) return `${normalized}\n`;

  const body = normalized.replace(
    /^(\s*\d{1,3}:\d{2}:\d{2}),(\d{3})(\s*-->\s*\d{1,3}:\d{2}:\d{2}),(\d{3})(.*)$/gm,
    "$1.$2$3.$4$5",
  );
  return `WEBVTT\n\n${body}\n`;
}

/**
 * Build a subtitle object URL with an idempotent cleanup function. Call revoke
 * whenever the active course changes and on component unmount.
 */
export function createSubtitleObjectUrl(
  bytes: Uint8Array,
  kind: "srt" | "vtt",
  urlApi: UrlApi | undefined = typeof URL !== "undefined" && "createObjectURL" in URL ? URL : undefined,
): RevocableMediaUrl {
  if (!urlApi) throw new Error("Object URLs are unavailable in this environment.");
  const decoded = decodeSubtitleBytes(bytes);
  const text = kind === "srt" ? srtToVtt(decoded) : decoded;
  const url = urlApi.createObjectURL(new Blob([text], { type: "text/vtt;charset=utf-8" }));
  let revoked = false;
  return {
    url,
    text,
    revoke: () => {
      if (revoked) return;
      revoked = true;
      urlApi.revokeObjectURL(url);
    },
  };
}

export function subtitleKindFromName(name: string): "srt" | "vtt" | null {
  const extension = name.toLowerCase().match(/\.([^.]+)$/)?.[1];
  return extension === "srt" || extension === "vtt" ? extension : null;
}
