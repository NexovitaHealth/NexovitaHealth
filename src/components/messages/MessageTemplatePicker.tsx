"use client";

import {
  getMessageTemplatesForAudience,
  type MessageTemplate,
} from "@/lib/message-templates";

interface Props {
  onSelect: (template: MessageTemplate) => void;
  className?: string;
  audience?: "clinical" | "field" | "all";
}

export function MessageTemplatePicker({
  onSelect,
  className = "",
  audience = "all",
}: Props) {
  const templates = getMessageTemplatesForAudience(audience);

  return (
    <div className={className}>
      <p className="text-xs font-medium text-slate-500 mb-2">Quick templates</p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-none">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            className="snap-start shrink-0 px-3 py-2 min-h-[44px] rounded-xl text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:border-[#028090]/40 hover:text-[#028090] transition-colors"
          >
            {template.label}
          </button>
        ))}
      </div>
    </div>
  );
}
