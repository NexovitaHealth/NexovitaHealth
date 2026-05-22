/**
 * Nexovita API Client
 * Provides typed methods for implemented API resources only.
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

async function download(path: string, options: RequestInit = {}): Promise<Blob> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
  });

  if (!res.ok) {
    const json = await res
      .json()
      .catch(() => ({ error: `Request failed: ${res.status}` }));
    throw new ApiError(res.status, json.error ?? "Request failed");
  }

  return res.blob();
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
    phone?: string;
    inviteToken?: string;
    orgName?: string;
  }) => post("/auth/register", data),

  login: (email: string, password: string) =>
    post<{
      user: {
        id: string;
        email: string;
        fullName: string;
        role: string;
        orgMemberships: unknown[];
      };
    }>("/auth/login", {
      email,
      password,
    }),

  logout: () => post("/auth/logout"),

  me: () => get<any>("/auth/me"),

  forgotPassword: (email: string) => post("/auth/forgot-password", { email }),

  resetPassword: (token: string, password: string) =>
    post("/auth/reset-password", { token, password }),
};

export const notifications = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    isRead?: boolean;
    type?: string;
  }) => get<any[]>(`/notifications${query(params)}`),
  mark: (notificationId: string, isRead = true) =>
    patch<any>(`/notifications/${notificationId}`, { isRead }),
  markMany: (notificationIds?: string[], isRead = true) =>
    patch<{ updated: number }>("/notifications", { notificationIds, isRead }),
  markAllRead: () => patch<{ updated: number }>("/notifications", { isRead: true }),
};

export const settings = {
  get: () => get<any>("/settings"),
  update: (data: unknown) => patch<any>("/settings", data),
};

function query(params?: Record<string, string | number | boolean | undefined>) {
  const qs = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) qs.set(key, String(value));
    });
  }
  const value = qs.toString();
  return value ? `?${value}` : "";
}

export function orgApi(orgId: string) {
  const orgBase = `/orgs/${orgId}`;
  return {
    patients: {
      list: (params?: {
        page?: number;
        pageSize?: number;
        search?: string;
        status?: string;
        riskLevel?: string;
      }) => get<any[]>(`${orgBase}/patients${query(params)}`),
      get: (patientId: string) => get<any>(`${orgBase}/patients/${patientId}`),
      create: (data: unknown) => post<any>(`${orgBase}/patients`, data),
      update: (patientId: string, data: unknown) =>
        patch<any>(`${orgBase}/patients/${patientId}`, data),
      delete: (patientId: string) => del<any>(`${orgBase}/patients/${patientId}`),
      vitals: {
        list: (patientId: string, limit = 20) =>
          get<any[]>(`${orgBase}/patients/${patientId}/vitals?limit=${limit}`),
        create: (patientId: string, data: unknown) =>
          post<any>(`${orgBase}/patients/${patientId}/vitals`, data),
      },
    },
    carePlans: {
      list: (params?: {
        page?: number;
        pageSize?: number;
        patientId?: string;
        status?: string;
      }) => get<any[]>(`${orgBase}/care-plans${query(params)}`),
      get: (carePlanId: string) =>
        get<any>(`${orgBase}/care-plans/${carePlanId}`),
      create: (data: {
        patientId: string;
        title: string;
        goals?: unknown[];
        interventions?: unknown[];
        status?: "draft" | "active";
        startDate?: string;
        reviewDate?: string;
      }) => post<any>(`${orgBase}/care-plans`, data),
      update: (
        carePlanId: string,
        data: {
          title?: string;
          goals?: unknown[];
          interventions?: unknown[];
          status?: "draft" | "active" | "superseded" | "expired" | "discontinued";
          startDate?: string | null;
          reviewDate?: string | null;
        },
      ) => patch<any>(`${orgBase}/care-plans/${carePlanId}`, data),
      delete: (carePlanId: string) =>
        del<any>(`${orgBase}/care-plans/${carePlanId}`),
      renew: (
        carePlanId: string,
        data?: {
          title?: string;
          goals?: unknown[];
          interventions?: unknown[];
          startDate?: string;
          reviewDate?: string;
        },
      ) => post<any>(`${orgBase}/care-plans/${carePlanId}/renew`, data),
      sign: (
        carePlanId: string,
        data?: { signatureMeaning?: string },
      ) => post<any>(`${orgBase}/care-plans/${carePlanId}/sign`, data),
    },
    physicianOrders: {
      list: (params?: {
        page?: number;
        pageSize?: number;
        patientId?: string;
        physicianId?: string;
        carePlanId?: string;
        status?: string;
      }) => get<any[]>(`${orgBase}/physician-orders${query(params)}`),
      get: (orderId: string) =>
        get<any>(`${orgBase}/physician-orders/${orderId}`),
      create: (data: {
        patientId: string;
        physicianId?: string;
        carePlanId?: string;
        escalationId?: string;
        orderType: string;
        title: string;
        instructions: string;
        status?: "draft" | "active";
        effectiveAt?: string;
        expiresAt?: string;
        metadata?: Record<string, unknown>;
      }) => post<any>(`${orgBase}/physician-orders`, data),
      update: (
        orderId: string,
        data: {
          orderType?: string;
          title?: string;
          instructions?: string;
          status?: "draft" | "active" | "completed" | "discontinued" | "cancelled";
          effectiveAt?: string | null;
          expiresAt?: string | null;
          metadata?: Record<string, unknown>;
        },
      ) => patch<any>(`${orgBase}/physician-orders/${orderId}`, data),
      sign: (orderId: string, data?: { signatureMeaning?: string }) =>
        post<any>(`${orgBase}/physician-orders/${orderId}/sign`, data),
      discontinue: (orderId: string, reason: string) =>
        post<any>(`${orgBase}/physician-orders/${orderId}/discontinue`, {
          reason,
        }),
    },
    escalations: {
      list: (params?: {
        page?: number;
        pageSize?: number;
        patientId?: string;
        status?: string;
        severity?: string;
      }) => get<any[]>(`${orgBase}/escalations${query(params)}`),
      get: (escalationId: string) =>
        get<any>(`${orgBase}/escalations/${escalationId}`),
      create: (data: {
        patientId: string;
        category: string;
        title: string;
        description: string;
        severity?: "info" | "warning" | "critical";
        assignedToId?: string;
        sourceVitalId?: string;
        sourceVisitId?: string;
        incidentId?: string;
      }) => post<any>(`${orgBase}/escalations`, data),
      update: (
        escalationId: string,
        data: {
          status?: "open" | "in_review" | "resolved" | "cancelled";
          severity?: "info" | "warning" | "critical";
          assignedToId?: string | null;
          clinicalResponse?: string | null;
          title?: string;
          description?: string;
        },
      ) => patch<any>(`${orgBase}/escalations/${escalationId}`, data),
    },
    incidents: {
      list: (params?: {
        page?: number;
        pageSize?: number;
        patientId?: string;
        status?: string;
        severity?: string;
      }) => get<any[]>(`${orgBase}/incidents${query(params)}`),
      get: (incidentId: string) =>
        get<any>(`${orgBase}/incidents/${incidentId}`),
      create: (data: {
        patientId: string;
        incidentType: string;
        description: string;
        severity?: "info" | "warning" | "critical";
        occurredAt: string;
        visitLogId?: string;
        immediateAction?: string;
        assignedToId?: string;
        createEscalation?: boolean;
      }) => post<any>(`${orgBase}/incidents`, data),
      update: (
        incidentId: string,
        data: {
          status?: "reported" | "triaged" | "resolved" | "closed";
          severity?: "info" | "warning" | "critical";
          assignedToId?: string | null;
          immediateAction?: string | null;
          resolution?: string | null;
        },
      ) => patch<any>(`${orgBase}/incidents/${incidentId}`, data),
    },
    projects: {
      list: () => get<any[]>(`${orgBase}/projects`),
      create: (data: unknown) => post<any>(`${orgBase}/projects`, data),
    },
    tasks: {
      list: (params?: {
        page?: number;
        pageSize?: number;
        search?: string;
        status?: string;
        priority?: string;
        projectId?: string;
      }) => get<any[]>(`${orgBase}/tasks${query(params)}`),
      get: (taskId: string) => get<any>(`${orgBase}/tasks/${taskId}`),
      create: (data: unknown) => post<any>(`${orgBase}/tasks`, data),
      update: (taskId: string, data: unknown) =>
        patch<any>(`${orgBase}/tasks/${taskId}`, data),
      delete: (taskId: string) => del<any>(`${orgBase}/tasks/${taskId}`),
    },
    members: {
      list: () => get<any[]>(`${orgBase}/members`),
      remove: (userId: string) =>
        request<{ removed: boolean }>(`${orgBase}/members`, {
          method: "DELETE",
          body: JSON.stringify({ userId }),
          headers: { "Content-Type": "application/json" },
        }),
    },
    invitations: {
      list: () => get<any[]>(`${orgBase}/invite`),
      invite: (email: string, role: string) =>
        post<any>(`${orgBase}/invite`, { email, role }),
    },
    familyCaregivers: {
      list: (params?: {
        page?: number;
        pageSize?: number;
        patientId?: string;
        status?: string;
      }) => get<any[]>(`${orgBase}/family-caregivers${query(params)}`),
      create: (data: {
        patientId: string;
        email: string;
        fullName: string;
        phone?: string;
        relationship: string;
        canViewSchedule?: boolean;
        canViewCarePlan?: boolean;
        canViewVitals?: boolean;
        canMessageCareTeam?: boolean;
      }) => post<any>(`${orgBase}/family-caregivers`, data),
      approve: (accountId: string) =>
        patch<any>(`${orgBase}/family-caregivers/${accountId}/approve`, {}),
      reject: (accountId: string) =>
        patch<any>(`${orgBase}/family-caregivers/${accountId}/reject`, {}),
      revoke: (accountId: string) =>
        patch<any>(`${orgBase}/family-caregivers/${accountId}/revoke`, {}),
      issuePortalAccess: (accountId: string) =>
        post<{ portalUrl: string; expiresAt: string; token: string }>(
          `${orgBase}/family-caregivers/${accountId}/portal-access`,
        ),
    },
    portalAccess: {
      issueForPatient: (patientId: string) =>
        post<{ portalUrl: string; expiresAt: string; token: string }>(
          `${orgBase}/patients/${patientId}/portal-access`,
        ),
    },
    audit: {
      list: (params?: {
        page?: number;
        pageSize?: number;
        resourceType?: string;
        actorId?: string;
      }) => get<any[]>(`${orgBase}/audit${query(params)}`),
    },
    settings: {
      get: () => get<any>(`${orgBase}/settings`),
      update: (data: unknown) => patch<any>(`${orgBase}/settings`, data),
    },
    labs: {
      list: (params?: { search?: string; status?: string; limit?: number }) =>
        get<any[]>(`${orgBase}/labs${query(params)}`),
    },
    alerts: {
      list: (params?: {
        page?: number;
        pageSize?: number;
        resolved?: "true" | "false" | "all";
        severity?: string;
        patientId?: string;
        alertType?: string;
      }) => get<any[]>(`${orgBase}/alerts${query(params)}`),
      get: (alertId: string) => get<any>(`${orgBase}/alerts/${alertId}`),
      resolve: (alertId: string) =>
        patch<any>(`${orgBase}/alerts/${alertId}`, { action: "resolve" }),
    },
    dashboard: {
      summary: () =>
        get<{
          totalPatients: number;
          highRiskPatients: number;
          openTasks: number;
          unresolvedAlerts: number;
          visitsToday: number;
          pendingVisitReviews: number;
          missedVisitsToday: number;
        }>(`${orgBase}/dashboard`),
    },
    schedule: {
      list: (params?: { startDate?: string; endDate?: string }) =>
        get<any[]>(`${orgBase}/schedule${query(params)}`),
    },
    visits: {
      list: (params?: {
        page?: number;
        pageSize?: number;
        status?: string;
        staffId?: string;
        patientId?: string;
        startDate?: string;
        endDate?: string;
      }) => get<any[]>(`${orgBase}/visits${query(params)}`),
      get: (visitId: string) => get<any>(`${orgBase}/visits/${visitId}`),
      create: (data: {
        patientId: string;
        staffId: string;
        visitType: string;
        scheduledAt: string;
        notes?: string;
        serviceAddress?: string;
      }) => post<any>(`${orgBase}/visits`, data),
      update: (
        visitId: string,
        data: {
          visitType?: string;
          scheduledAt?: string;
          status?: "scheduled" | "in_progress" | "completed" | "missed" | "cancelled";
          notes?: string;
          serviceAddress?: string;
        },
      ) => patch<any>(`${orgBase}/visits/${visitId}`, data),
      checkIn: (
        visitId: string,
        data: {
          latitude: number;
          longitude: number;
          checkedInAt?: string;
          radiusMeters?: number;
        },
      ) => post<any>(`${orgBase}/visits/${visitId}/check-in`, data),
      checkOut: (
        visitId: string,
        data: {
          latitude: number;
          longitude: number;
          checkedOutAt?: string;
          notes?: string;
          radiusMeters?: number;
        },
      ) => post<any>(`${orgBase}/visits/${visitId}/check-out`, data),
      submit: (visitId: string) =>
        post<any>(`${orgBase}/visits/${visitId}/submit`),
      updateTask: (
        visitId: string,
        taskId: string,
        data: {
          status: "pending" | "in_progress" | "completed" | "skipped" | "refused";
          notes?: string;
        },
      ) => patch<any>(`${orgBase}/visits/${visitId}/tasks/${taskId}`, data),
      processMissed: () =>
        post<{ marked: number; visitIds: string[] }>(
          `${orgBase}/visits/process-missed`,
        ),
    },
    review: {
      visits: (params?: {
        page?: number;
        pageSize?: number;
        status?: "pending" | "approved" | "needs_correction" | "rejected";
        patientId?: string;
      }) => get<any[]>(`${orgBase}/review/visits${query(params)}`),
      decideVisit: (
        visitId: string,
        data: {
          status: "approved" | "needs_correction" | "rejected";
          clinicalNotes?: string;
          correctionReason?: string;
          billingHoldReason?: string;
        },
      ) => patch<any>(`${orgBase}/review/visits/${visitId}`, data),
    },
    authorisations: {
      list: (params?: {
        page?: number;
        pageSize?: number;
        patientId?: string;
        status?: string;
      }) => get<any[]>(`${orgBase}/authorisations${query(params)}`),
      get: (authorisationId: string) =>
        get<any>(`${orgBase}/authorisations/${authorisationId}`),
      create: (data: {
        patientId: string;
        payerName: string;
        authorisationNumber: string;
        startDate: string;
        endDate: string;
        unitsAuthorised: number;
        payerType?: string;
        serviceCode?: string;
        status?: "active" | "pending" | "exhausted" | "expired" | "cancelled";
        unitType?: string;
        notes?: string;
      }) => post<any>(`${orgBase}/authorisations`, data),
      update: (
        authorisationId: string,
        data: {
          payerName?: string;
          payerType?: string | null;
          serviceCode?: string | null;
          status?: "active" | "pending" | "exhausted" | "expired" | "cancelled";
          startDate?: string;
          endDate?: string;
          unitsAuthorised?: number;
          unitType?: string;
          notes?: string | null;
        },
      ) => patch<any>(`${orgBase}/authorisations/${authorisationId}`, data),
      delete: (authorisationId: string) =>
        del<any>(`${orgBase}/authorisations/${authorisationId}`),
    },
    billing: {
      queue: (params?: { page?: number; pageSize?: number }) =>
        get<any[]>(`${orgBase}/billing/queue${query(params)}`),
      claims: {
        list: (params?: {
          page?: number;
          pageSize?: number;
          status?: string;
          patientId?: string;
        }) => get<any[]>(`${orgBase}/billing/claims${query(params)}`),
        get: (claimId: string) =>
          get<any>(`${orgBase}/billing/claims/${claimId}`),
        create: (data: {
          visitId: string;
          serviceCode: string;
          totalAmount?: number;
          units?: number;
          diagnosisCodes?: string[];
          procedureCodes?: string[];
          authorisationId?: string;
        }) => post<any>(`${orgBase}/billing/claims`, data),
        update: (
          claimId: string,
          data: {
            status?: "queued" | "submitted" | "paid" | "denied" | "voided";
            denialReason?: string;
            paymentReference?: string;
            paidAmount?: number;
            metadata?: Record<string, unknown>;
          },
        ) => patch<any>(`${orgBase}/billing/claims/${claimId}`, data),
      },
      submissions: {
        list: (params?: { page?: number; pageSize?: number }) =>
          get<any[]>(`${orgBase}/billing/submissions${query(params)}`),
        submit: (data?: { claimIds?: string[]; payerName?: string }) =>
          post<{ batch: any; exportCsv: string }>(
            `${orgBase}/billing/submissions`,
            data,
          ),
        exportCsv: (batchId: string) =>
          download(`${orgBase}/billing/submissions/${batchId}/export`, {
            headers: { Accept: "text/csv" },
          }),
      },
    },
    emailDeliveries: {
      list: (params?: {
        page?: number;
        pageSize?: number;
        status?: string;
      }) =>
        get<{ items: any[]; total: number }>(
          `${orgBase}/email-deliveries${query(params)}`,
        ),
      retry: (deliveryId: string) =>
        post<any>(`${orgBase}/email-deliveries/${deliveryId}/retry`),
    },
    messages: {
      threads: () => get<any[]>(`${orgBase}/messages/threads`),
      thread: (threadId: string) =>
        get<any[]>(`${orgBase}/messages/threads/${threadId}`),
      send: (data: {
        threadId?: string;
        recipientIds?: string[];
        patientId?: string;
        subject?: string;
        content: string;
      }) => post<any>(`${orgBase}/messages`, data),
    },
    reports: {
      get: (type: string, range = "30d") =>
        get<any>(`${orgBase}/reports/${type}?range=${range}`),
      exportCsv: (type: string, range = "30d") =>
        download(`${orgBase}/reports/${type}/export?range=${range}`, {
          headers: { Accept: "text/csv" },
        }),
      exportPdf: (type: string, range = "30d") =>
        download(`${orgBase}/reports/${type}/export?range=${range}&format=pdf`, {
          headers: { Accept: "application/pdf" },
        }),
    },
  };
}

export const audit = {
  forOrg: (orgId: string) => orgApi(orgId).audit,
};

export const orgSettings = {
  forOrg: (orgId: string) => orgApi(orgId).settings,
};

export const patients = {
  forOrg: (orgId: string) => orgApi(orgId).patients,
};

export const carePlans = {
  forOrg: (orgId: string) => orgApi(orgId).carePlans,
};

export const physicianOrders = {
  forOrg: (orgId: string) => orgApi(orgId).physicianOrders,
};

export const tasks = {
  forOrg: (orgId: string) => orgApi(orgId).tasks,
};

export const projects = {
  forOrg: (orgId: string) => orgApi(orgId).projects,
};

export const messages = {
  forOrg: (orgId: string) => orgApi(orgId).messages,
};

export const reports = {
  forOrg: (orgId: string) => orgApi(orgId).reports,
};

export const labs = {
  forOrg: (orgId: string) => orgApi(orgId).labs,
};

export const schedule = {
  forOrg: (orgId: string) => orgApi(orgId).schedule,
};

export const visits = {
  forOrg: (orgId: string) => orgApi(orgId).visits,
};

export const review = {
  forOrg: (orgId: string) => orgApi(orgId).review,
};

export const billing = {
  forOrg: (orgId: string) => orgApi(orgId).billing,
};

export const members = {
  forOrg: (orgId: string) => orgApi(orgId).members,
};

export const invitations = {
  forOrg: (orgId: string) => orgApi(orgId).invitations,
};

export const familyCaregivers = {
  forOrg: (orgId: string) => orgApi(orgId).familyCaregivers,
};

export const portalAccess = {
  forOrg: (orgId: string) => orgApi(orgId).portalAccess,
};

export const portal = {
  login: (token: string) => post<any>("/portal/auth/login", { token }),
  logout: () => post("/portal/auth/logout"),
  me: () => get<any>("/portal/auth/me"),
  overview: () => get<any>("/portal/overview"),
  carePlan: () => get<any>("/portal/care-plan"),
  vitals: (limit = 20) => get<any[]>(`/portal/vitals?limit=${limit}`),
  visits: (days = 30) => get<any[]>(`/portal/visits?days=${days}`),
  medications: () => get<any[]>("/portal/medications"),
  labs: () => get<any[]>("/portal/labs"),
  documents: () => get<any[]>("/portal/documents"),
  careTeam: () => get<any[]>("/portal/care-team"),
  messageThreads: () => get<any[]>("/portal/messages/threads"),
  messageThread: (threadId: string) =>
    get<any[]>(`/portal/messages/threads/${threadId}`),
  sendMessage: (data: { content: string; threadId?: string; subject?: string }) =>
    post<any>("/portal/messages", data),
};

export { ApiError };
export default {
  auth,
  notifications,
  settings,
  orgApi,
  audit,
  orgSettings,
  patients,
  carePlans,
  physicianOrders,
  tasks,
  projects,
  messages,
  reports,
  labs,
  schedule,
  visits,
  review,
  billing,
  members,
  invitations,
  familyCaregivers,
  portalAccess,
  portal,
};
