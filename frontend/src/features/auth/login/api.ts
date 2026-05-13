import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/entities/user/api/auth";
import { useAuthStore } from "@/entities/user/model/authStore";
import { extractApiError } from "@/shared/api/axios";

export const useLoginMutation = () => {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => setSession(data.token, data.user),
    meta: { errorParser: extractApiError },
  });
};
