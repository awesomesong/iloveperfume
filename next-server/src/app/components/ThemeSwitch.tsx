"use client";
import { FiSun, FiMoon } from "react-icons/fi";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import ShapesSkeleton from "./skeleton/ShapesSkeleton";

export default function ThemeSwitch() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => { setMounted(true); }, []);

  if (!mounted)
    return <ShapesSkeleton width="22px" height="22px" radius="sm" />;

  const isDark = resolvedTheme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") toggle();
  };

  const Icon = isDark ? FiSun : FiMoon;

  return (
    <Icon
      size={20}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      style={{ color: "var(--color-text-primary)" }}
      className="cursor-pointer transition-transform duration-300 hover:rotate-12 focus:outline-none"
    />
  );
}
