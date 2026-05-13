import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/entities/user/api/auth";
import { useAuthStore } from "@/entities/user/model/authStore";

export const useSignupMutation = () => {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: authApi.signup,
    onSuccess: (data) => setSession(data.token, data.user),
  });
};
