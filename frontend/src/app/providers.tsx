"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useState } from "react";
import { createQueryClient } from "@/shared/api/queryClient";
import { useAuthStore } from "@/entities/user/model/authStore";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  const [client] = useState(() => createQueryClient());
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
};
