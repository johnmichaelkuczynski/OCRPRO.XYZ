import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface AuthUser {
  id: number;
  username: string;
  email: string | null;
  displayName: string | null;
}

interface AuthResponse {
  authenticated: boolean;
  user: AuthUser | null;
}

async function fetchAuth(): Promise<AuthResponse> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });
  if (!response.ok) {
    return { authenticated: false, user: null };
  }
  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<AuthResponse>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchAuth,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], {
        authenticated: false,
        user: null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  return {
    user: data?.user ?? null,
    isAuthenticated: data?.authenticated ?? false,
    isLoading,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
