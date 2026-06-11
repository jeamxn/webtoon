import { App as AntApp, theme as antdTheme, ConfigProvider } from "antd";
import koKR from "antd/locale/ko_KR";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemeMode = "light" | "dark" | "system";
type Resolved = "light" | "dark";

const STORAGE_KEY = "webtoon-theme-mode";

interface ThemeCtx {
  mode: ThemeMode;
  resolved: Resolved;
  setMode: (m: ThemeMode) => void;
}

const Ctx = createContext<ThemeCtx>({
  mode: "system",
  resolved: "dark",
  setMode: () => {},
});

export function useTheme(): ThemeCtx {
  return useContext(Ctx);
}

function systemPref(): Resolved {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function loadMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

// Chroma Glass Canvas 글로벌 스타일 정의
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(loadMode);
  const [system, setSystem] = useState<Resolved>(systemPref);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystem(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: Resolved = mode === "system" ? system : mode;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    window.localStorage.setItem(STORAGE_KEY, m);
  }, []);

  const ctx = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);

  const dark = resolved === "dark";

  return (
    <Ctx.Provider value={ctx}>
      <ConfigProvider
        locale={koKR}
        theme={{
          algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: {
            borderRadius: 16,
            fontFamily:
              '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: 14,
            lineHeight: 1.6,
            colorPrimary: dark ? "#818CF8" : "#6366F1",
            colorInfo: dark ? "#38BDF8" : "#06B6D4",
            colorBgLayout: dark ? "#08090D" : "#F8FAFC",
            colorBgContainer: dark ? "rgba(17, 19, 28, 0.65)" : "rgba(255, 255, 255, 0.75)",
            colorBorderSecondary: dark ? "rgba(255, 255, 255, 0.07)" : "rgba(15, 23, 42, 0.06)",
          },
          components: {
            Card: {
              colorBgContainer: dark ? "rgba(17, 19, 28, 0.65)" : "rgba(255, 255, 255, 0.75)",
              paddingLG: 24,
              borderRadiusLG: 16,
            },
            Button: {
              controlHeight: 42,
              controlHeightLG: 50,
              borderRadius: 12,
              fontWeight: 600,
              contentFontSize: 14,
              contentFontSizeLG: 16,
            },
            Segmented: {
              trackBg: dark ? "rgba(255, 255, 255, 0.05)" : "rgba(15, 23, 42, 0.04)",
              itemSelectedBg: dark ? "rgba(255, 255, 255, 0.1)" : "#ffffff",
              borderRadiusSM: 8,
            },
            Steps: {
              iconSize: 32,
              customIconSize: 32,
            },
            Input: {
              controlHeight: 42,
              borderRadius: 12,
              colorBgContainer: dark ? "rgba(0, 0, 0, 0.2)" : "rgba(255, 255, 255, 0.5)",
              activeBorderColor: dark ? "#818CF8" : "#6366F1",
              hoverBorderColor: dark ? "#38BDF8" : "#06B6D4",
            },
          },
        }}
      >
        <AntApp>{children}</AntApp>
      </ConfigProvider>
    </Ctx.Provider>
  );
}
