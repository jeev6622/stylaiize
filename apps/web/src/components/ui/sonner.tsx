"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#0b0f1a] group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-gradient-to-r group-[.toast]:from-violet-500 group-[.toast]:to-fuchsia-500 group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-secondary group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
