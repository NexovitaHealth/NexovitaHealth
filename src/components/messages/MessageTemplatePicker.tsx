"use client";

import { MESSAGE_TEMPLATES, type MessageTemplate } from "@/lib/message-templates";

interface Props {
  onSelect: (template: MessageTemplate) => void;
  className?: string;
}

export function MessageTemplatePicker({ onSelect, className = "" }: Props) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-slate-500 mb-2">Templates</p>
      <div className="flex flex-wrap gap-2">
        {MESSAGE_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:border-[#028090]/40 hover:text-[#028090] transition-colors"
          >
            {template.label}
          </button>
        ))}
      </div>
    </div>
  );
}
