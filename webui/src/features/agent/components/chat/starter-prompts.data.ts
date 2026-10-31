import {
  CodeStarterIcon,
  LearnStarterIcon,
  VisualizeStarterIcon,
  WriteNoteStarterIcon,
} from "@/components/icons"
import type { AppIconComponent } from "@/components/icons"


export type StarterPromptDefinition = {
  id: string
  /** Locale key — rendered through `t()` by the pills. */
  label: string
  /** Locale key — rendered through `t()` by the pills. */
  description: string
  /** Locale key — the prompt becomes the user's first message, so it follows the UI language. */
  prompt: string
  icon: AppIconComponent
}


export const STARTER_PROMPTS: StarterPromptDefinition[] = [
  {
    id: "learn",
    label: "agent.starter_prompts.learn_label",
    description: "agent.starter_prompts.learn_description",
    icon: LearnStarterIcon,
    prompt: "agent.starter_prompts.learn_prompt",
  },
  {
    id: "visualize",
    label: "agent.starter_prompts.visualize_label",
    description: "agent.starter_prompts.visualize_description",
    icon: VisualizeStarterIcon,
    prompt: "agent.starter_prompts.visualize_prompt",
  },
  {
    id: "write-note",
    label: "agent.starter_prompts.write_note_label",
    description: "agent.starter_prompts.write_note_description",
    icon: WriteNoteStarterIcon,
    prompt: "agent.starter_prompts.write_note_prompt",
  },
  {
    id: "code",
    label: "agent.starter_prompts.code_label",
    description: "agent.starter_prompts.code_description",
    icon: CodeStarterIcon,
    prompt: "agent.starter_prompts.code_prompt",
  },
]
