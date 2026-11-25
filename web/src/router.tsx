/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { createContext, useContext, type ComponentPropsWithoutRef } from "react";

type Routing = {
  basePath: string;
  portfolioUrl: string;
  navigate?: (href: string) => void;
};

export const RoutingContext = createContext<Routing>({ basePath: "", portfolioUrl: "/" });
export function useRouting() {
  return useContext(RoutingContext);
}

export function routeHref(basePath: string, href: string) {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const cut = href.search(/[?#]/);
  const path = cut < 0 ? href : href.slice(0, cut);
  const suffix = cut < 0 ? "" : href.slice(cut);
  return basePath + path.replace(/\/+$/, "") + "/" + suffix;
}

export function useRouter() {
  const { navigate, basePath } = useRouting();
  return {
    push(href: string) {
      if (navigate) navigate(href);
      else if (typeof window !== "undefined") window.location.assign(routeHref(basePath, href));
    },
  };
}

type LinkProps = ComponentPropsWithoutRef<"a"> & { href: string };

export default function Link({ href, onClick, ...props }: LinkProps) {
  const { basePath, navigate } = useRouting();
  return <a {...props} href={routeHref(basePath, href)} onClick={(event) => {
    onClick?.(event);
    if (!navigate || !href.startsWith("/") || href.startsWith("//") || event.defaultPrevented
        || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey
        || (props.target && props.target !== "_self") || props.download) return;
    event.preventDefault();
    navigate(href);
  }} />;
}
