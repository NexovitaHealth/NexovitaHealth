import { useCallback } from "react";
import { useAuth } from "./useAuth";

// The shape returned by all API routes via success(), paginated(), etc.
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore?: boolean;
  };
  error?: string;
}

export function useApi() {
  const { activeOrg } = useAuth();

  const request = useCallback(
    async <T = unknown>(
      path: string,
      options?: RequestInit,
    ): Promise<ApiResponse<T>> => {
      const orgId = activeOrg?.orgId;
      const url =
        orgId && path.includes("{orgId}")
          ? path.replace("{orgId}", orgId)
          : path;

      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...(options?.headers ?? {}),
        },
        ...options,
      });

      const json = (await res.json()) as ApiResponse<T>;
      if (!res.ok)
        throw new Error(json.error ?? `Request failed: ${res.status}`);
      return json;
    },
    [activeOrg],
  );

  return { request, orgId: activeOrg?.orgId };
}
