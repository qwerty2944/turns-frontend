/**
 * Bridge to the Flutter app's InAppWebView.
 *
 * While the app shows its NATIVE pre-game lobby, this page runs hidden
 * behind it and stays the single Colyseus connection: we push normalized
 * lobby snapshots up to Flutter (callHandler) and accept commands back
 * (window.__turnsApp.cmd) that translate to room messages.
 *
 * Timing: `window.flutter_inappwebview.callHandler` only becomes usable
 * after the `flutterInAppWebViewPlatformReady` event. Early snapshots are
 * cached per-handler and replayed when the platform comes up — otherwise
 * a quiet lobby (no further state changes) would leave the native UI
 * waiting forever.
 */

type AppWindow = Window & {
  flutter_inappwebview?: {
    callHandler: (name: string, ...args: unknown[]) => Promise<unknown>;
  };
  __turnsApp?: {
    cmd: (name: string, payloadJson?: string) => void;
  };
};

const w = (): AppWindow | null =>
  typeof window === "undefined" ? null : (window as unknown as AppWindow);

let platformReady = false;
const pendingByHandler = new Map<string, unknown>();

if (typeof window !== "undefined") {
  window.addEventListener("flutterInAppWebViewPlatformReady", () => {
    platformReady = true;
    for (const [handler, payload] of pendingByHandler) {
      postToApp(handler, payload);
    }
    pendingByHandler.clear();
  });
}

const callHandlerUsable = (): boolean =>
  !!w()?.flutter_inappwebview?.callHandler;

export const isInApp = (): boolean =>
  platformReady ||
  callHandlerUsable() ||
  // 앱 웹뷰는 항상 tk 파라미터로 진입한다 — platformReady 이전에도 참으로.
  (typeof location !== "undefined" &&
    new URLSearchParams(location.search).has("tk"));

export const postToApp = (handler: string, payload: unknown) => {
  if (!callHandlerUsable()) {
    // 플랫폼 준비 전 — 최신 페이로드만 캐시했다가 ready 시 재전송.
    pendingByHandler.set(handler, payload);
    return;
  }
  try {
    w()!.flutter_inappwebview!.callHandler(handler, payload);
  } catch {
    pendingByHandler.set(handler, payload);
  }
};

/**
 * 게임 화면에서 로비로 나갈 때: 앱 안이면 네이티브 화면을 pop한다.
 * SPA 라우팅(router.push)은 웹뷰 URL 인터셉트에 걸리지 않으므로, 웹뷰
 * 안에서 웹 로비가 떠버리는 문제를 브릿지 이벤트로 해결한다.
 * @returns true면 앱이 내비게이션을 가져갔으니 웹 라우팅은 생략할 것.
 */
export const exitGameToApp = (): boolean => {
  if (!isInApp()) return false;
  postToApp("turnsExit", true);
  return true;
};

export type AppCommandMap = Record<string, (payload: unknown) => void>;

/** Register the command sink Flutter calls via evaluateJavascript. */
export const registerAppCommands = (commands: AppCommandMap): (() => void) => {
  const win = w();
  if (!win) return () => {};
  win.__turnsApp = {
    cmd: (name, payloadJson) => {
      const fn = commands[name];
      if (!fn) return;
      let payload: unknown = undefined;
      if (payloadJson) {
        try {
          payload = JSON.parse(payloadJson);
        } catch {
          payload = payloadJson;
        }
      }
      fn(payload);
    },
  };
  return () => {
    if (win.__turnsApp) delete win.__turnsApp;
  };
};
