import type { ComponentProps } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate } from "react-router-dom";

// BrowserRouter has no data-router view transition support; use the native API.
export function AuthLink(props: ComponentProps<typeof Link>) {
  const navigate = useNavigate();
  return (
    <Link
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          props.target ||
          typeof props.to !== "string" ||
          !["/login", "/register"].includes(props.to)
        )
          return;
        const page = document as Document & {
          startViewTransition?: (update: () => void) => {
            finished: Promise<void>;
          };
        };
        if (
          !page.startViewTransition ||
          matchMedia("(prefers-reduced-motion: reduce)").matches ||
          event.currentTarget.closest('[data-motion="paused"]')
        )
          return;
        event.preventDefault();
        const destination = props.to;
        document.documentElement.classList.add("auth-route-transition");
        const transition = page.startViewTransition(() =>
          flushSync(() => {
            void navigate(destination);
          }),
        );
        void transition.finished
          .catch(() => {})
          .finally(() =>
            document.documentElement.classList.remove("auth-route-transition"),
          );
      }}
    />
  );
}
