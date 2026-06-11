import { DesktopOutlined, MoonOutlined, SunOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Segmented } from "antd";
import { Link, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "./app.css";
import { type ThemeMode, ThemeProvider, useTheme } from "./theme";

const THEME_INIT = `(function(){try{var m=localStorage.getItem("webtoon-theme-mode");var r=m==="light"||m==="dark"?m:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r;}catch(e){}})();`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Webtoon Studio</title>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: theme bootstrap before paint */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function ThemeSwitch() {
  const { mode, setMode } = useTheme();
  return (
    <Segmented<ThemeMode>
      size="small"
      value={mode}
      onChange={setMode}
      options={[
        { value: "light", icon: <SunOutlined />, title: "라이트" },
        { value: "system", icon: <DesktopOutlined />, title: "시스템 설정" },
        { value: "dark", icon: <MoonOutlined />, title: "다크" },
      ]}
    />
  );
}

function Shell() {
  return (
    <>
      <header className="shell-header">
        <div className="shell-header-inner">
          <Link to="/" className="brand">
            <span className="brand-logo">
              <ThunderboltOutlined />
            </span>
            Webtoon Studio
          </Link>
          <div style={{ marginLeft: "auto" }}>
            <ThemeSwitch />
          </div>
        </div>
      </header>
      <Outlet />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );
}
