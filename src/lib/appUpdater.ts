import { toast } from "sonner";

export const isTauriRuntime =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type TauriUpdate = {
  version: string;
  currentVersion: string;
  body?: string | null;
  downloadAndInstall: (
    onEvent?: (event: {
      event: "Started" | "Progress" | "Finished";
      data?: { contentLength?: number; chunkLength?: number };
    }) => void,
  ) => Promise<void>;
};

const loadUpdaterModules = async () => {
  const [{ check }, { relaunch }] = await Promise.all([
    import("@tauri-apps/plugin-updater"),
    import("@tauri-apps/plugin-process"),
  ]);
  return { check, relaunch };
};

export const checkForAppUpdate = async (): Promise<TauriUpdate | null> => {
  if (!isTauriRuntime) return null;
  const { check } = await loadUpdaterModules();
  const update = (await check()) as TauriUpdate | null;
  return update ?? null;
};

const applyUpdate = async (update: TauriUpdate) => {
  const { relaunch } = await loadUpdaterModules();
  const progressToastId = toast.loading(
    `バージョン ${update.version} をダウンロード中… 0%`,
  );
  let total = 0;
  let downloaded = 0;
  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        total = event.data?.contentLength ?? 0;
        downloaded = 0;
      } else if (event.event === "Progress") {
        downloaded += event.data?.chunkLength ?? 0;
        const pct =
          total > 0
            ? Math.min(100, Math.round((downloaded / total) * 100))
            : null;
        toast.loading(
          pct === null
            ? `バージョン ${update.version} をダウンロード中…`
            : `バージョン ${update.version} をダウンロード中… ${pct}%`,
          { id: progressToastId },
        );
      } else if (event.event === "Finished") {
        toast.loading("インストールを実行しています…", { id: progressToastId });
      }
    });
    toast.success("更新を適用しました。アプリを再起動します…", {
      id: progressToastId,
    });
    await relaunch();
  } catch (err) {
    console.error("[updater] failed to install update", err);
    toast.error("更新の適用に失敗しました。後でもう一度お試しください。", {
      id: progressToastId,
    });
  }
};

const promptInstall = (update: TauriUpdate) => {
  toast.message(`新しいバージョン ${update.version} があります`, {
    description: update.body?.trim()
      ? update.body.trim().slice(0, 240)
      : "アプリを更新すると最新の機能と修正が反映されます。",
    duration: 20000,
    action: {
      label: "更新する",
      onClick: () => {
        void applyUpdate(update);
      },
    },
    cancel: { label: "後で", onClick: () => {} },
  });
};

export const runStartupUpdateCheck = async () => {
  if (!isTauriRuntime) return;
  try {
    const update = await checkForAppUpdate();
    if (update) promptInstall(update);
  } catch (err) {
    console.warn("[updater] startup check failed", err);
  }
};

export const runManualUpdateCheck = async () => {
  if (!isTauriRuntime) {
    toast.message("更新確認はデスクトップ版でのみ利用できます。");
    return;
  }
  const checkingToastId = toast.loading("更新を確認しています…");
  try {
    const update = await checkForAppUpdate();
    if (update) {
      toast.dismiss(checkingToastId);
      promptInstall(update);
    } else {
      toast.success("お使いのバージョンは最新です。", { id: checkingToastId });
    }
  } catch (err) {
    console.error("[updater] manual check failed", err);
    toast.error("更新の確認に失敗しました。", { id: checkingToastId });
  }
};
