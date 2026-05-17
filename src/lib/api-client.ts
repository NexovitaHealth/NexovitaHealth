/**
 * Nexovita API Client
 * Provides typed methods for every resource.
 */

const BASE = "/api";

class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
  });

  const json = await res
    .json()
    .catch(() => ({ success: false, error: "Invalid response" }));

  if (!res.ok) {
    throw new ApiError(res.status, json.error ?? "Request failed", json.errors);
  }

  return json.data as T;
}

function get<T>(path: string) {
  return request<T>(path, { method: "GET" });
}

function post<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

function patch<T>(path: string, body: unknown) {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

function del<T>(path: string) {
  return request<T>(path, { method: "DELETE" });
}

// =============================================
// Auth
// =============================================
export const auth = {
  register: (data: {
    email: string;
    password: string;
    fullName: string;
    role: string;
    agencyId?: string;
  }) => post("/auth/register", data),

  login: (email: string, password: string) =>
    post<{ user: { id: string; email: string; profile: any } }>("/auth/login", {
      email,
      password,
    }),

  logout: () => post("/auth/logout"),

  me: () => get<any>("/auth/me"),

  forgotPassword: (email: string) => post("/auth/forgot-password", { email }),

  resetPassword: (token: string, password: string) =>
    post("/auth/reset-password", { token, password }),
};

// =============================================
// Patients
// =============================================
export const patients = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    riskLevel?: string;
    careSetting?: string;
    sortBy?: string;
    sortDir?: "asc" | "desc";
  }) => {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v));
      });
    }
    return request<{ data: any[]; meta: any }>(`/patients?${qs}`);
  },

  get: (id: string) => get<any>(`/patients/${id}`),

  create: (data: any) => post<any>("/patients", data),

  update: (id: string, data: any) => patch<any>(`/patients/${id}`, data),

  delete: (id: string) => del<any>(`/patients/${id}`),

  vitals: {
    list: (patientId: string, days = 90) =>
      request<{ data: any[]; meta: any }>(
        `/patients/${patientId}/vitals?days=${days}`,
      ),
    create: (patientId: string, data: any) =>
      post<any>(`/patients/${patientId}/vitals`, data),
  },

  medications: {
    list: (patientId: string) =>
      get<any[]>(`/patients/${patientId}/medications`),
    create: (patientId: string, data: any) =>
      post<any>(`/patients/${patientId}/medications`, data),
  },

  carePlans: {
    list: (patientId: string) =>
      get<any[]>(`/patients/${patientId}/care-plans`),
    create: (patientId: string, data: any) =>
      post<any>(`/patients/${patientId}/care-plans`, data),
  },

  visits: {
    list: (patientId: string) => get<any[]>(`/patients/${patientId}/visits`),
  },

  documents: {
    list: (patientId: string) => get<any[]>(`/patients/${patientId}/documents`),
  },

  activity: {
    list: (patientId: string) => get<any[]>(`/patients/${patientId}/activity`),
  },
};

// =============================================
// Dashboard
// =============================================
export const dashboard = {
  stats: () => get<any>("/dashboard/stats"),
};

// =============================================
// Claims
// =============================================
export const claims = {
  list: (params?: { page?: number; status?: string; patientId?: string }) => {
    const qs = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => v && qs.set(k, String(v)));
    return request<{ data: any[]; meta: any }>(`/claims?${qs}`);
  },
  create: (data: any) => post<any>("/claims", data),
  update: (id: string, data: any) => patch<any>(`/claims/${id}`, data),
};

// =============================================
// Audit
// =============================================
export const audit = {
  list: (params?: {
    page?: number;
    resourceType?: string;
    action?: string;
    from?: string;
    to?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => v && qs.set(k, String(v)));
    return request<{ data: any[]; meta: any }>(`/audit?${qs}`);
  },
};

// =============================================
// Invitations
// =============================================
export const invitations = {
  list: () => get<any[]>("/invitations"),
  invite: (email: string, role: string) =>
    post<any>("/invitations", { email, role }),
  accept: (token: string, password: string, fullName: string) =>
    post<any>(`/invitations/${token}/accept`, { password, fullName }),
};

// =============================================
// Agencies
// =============================================
export const agencies = {
  create: (data: any) => post<any>("/agencies", data),
  get: (id: string) => get<any>(`/agencies/${id}`),
  update: (id: string, data: any) => patch<any>(`/agencies/${id}`, data),
  members: (id: string) => get<any[]>(`/agencies/${id}/members`),
};

// =============================================
// Visits
// =============================================
export const visits = {
  list: (params?: { page?: number; status?: string; staffId?: string }) => {
    const qs = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => v && qs.set(k, String(v)));
    return request<{ data: any[]; meta: any }>(`/visits?${qs}`);
  },
  create: (data: any) => post<any>("/visits", data),
  update: (id: string, data: any) => patch<any>(`/visits/${id}`, data),
  checkin: (id: string, lat?: number, lng?: number) =>
    patch<any>(`/visits/${id}`, {
      status: "IN_PROGRESS",
      checkInAt: new Date().toISOString(),
      checkInLat: lat,
      checkInLng: lng,
    }),
  checkout: (id: string, lat?: number, lng?: number) =>
    patch<any>(`/visits/${id}`, {
      status: "COMPLETED",
      checkOutAt: new Date().toISOString(),
      checkOutLat: lat,
      checkOutLng: lng,
    }),
};

export { ApiError };
export default {
  auth,
  patients,
  dashboard,
  claims,
  audit,
  invitations,
  agencies,
  visits,
};
