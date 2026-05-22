"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";

export function DocumentsTab({
  patientId,
  orgId,
}: {
  patientId: string;
  orgId: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("clinical");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["patient-documents", orgId, patientId],
    queryFn: async () => {
      const res = await fetch(`/api/orgs/${orgId}/patients/${patientId}/documents`);
      return res.json();
    },
    enabled: !!orgId && !!patientId,
  });

  const documents =
    (data?.data as Array<{
      id: string;
      title: string;
      documentType: string;
      fileUrl: string;
      mimeType: string;
      sizeBytes: number;
      isVerified: boolean;
      createdAt: string;
    }>) || [];

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title || file.name);
      form.append("documentType", documentType);
      const res = await fetch(
        `/api/orgs/${orgId}/patients/${patientId}/documents`,
        { method: "POST", body: form },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient-documents", orgId, patientId] });
      setTitle("");
      setError("");
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <form
        className="card p-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const file = fileRef.current?.files?.[0];
          if (!file) {
            setError("Choose a file");
            return;
          }
          uploadMutation.mutate(file);
        }}
      >
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Upload className="w-4 h-4" /> Upload document
        </h3>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm block">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-sm block">
            Type
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            >
              <option value="clinical">Clinical</option>
              <option value="consent">Consent</option>
              <option value="insurance">Insurance</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
          className="text-sm"
        />
        <button
          type="submit"
          disabled={uploadMutation.isPending}
          className="px-4 py-2 rounded-lg bg-[#028090] text-white text-sm font-medium"
        >
          {uploadMutation.isPending ? "Uploading…" : "Upload"}
        </button>
      </form>

      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-[#028090]" />
      ) : documents.length === 0 ? (
        <p className="text-sm text-slate-500">No documents uploaded.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="card p-4 flex justify-between items-center gap-2"
            >
              <div>
                <p className="font-medium text-slate-800">{doc.title}</p>
                <p className="text-xs text-slate-500 capitalize">
                  {doc.documentType} · {(doc.sizeBytes / 1024).toFixed(1)} KB
                  {doc.isVerified && " · verified"}
                </p>
              </div>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#028090] font-medium"
              >
                View
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
