import { Globe, Lock } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";

/** Who can see a race: everyone (built in or added by the admin), everyone because its runner published it, or only its runner. */
export type Visibility = "public" | "published" | "private";

export const visibilityOf = (r: { owner?: string; publishedBy?: string }): Visibility =>
  !r.owner ? "public" : r.publishedBy ? "published" : "private";

const LOOK: Record<Visibility, { tone: BadgeTone; label: string; icon: typeof Lock }> = {
  public: { tone: "success", label: "Public", icon: Globe },
  published: { tone: "success", label: "Published", icon: Globe },
  private: { tone: "neutral", label: "Private", icon: Lock },
};

/** The race's visibility as an Arc badge: green when everyone can see it, grey when private. */
export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const { tone, label, icon: Icon } = LOOK[visibility];
  return (
    <Badge tone={tone} size="sm" icon={<Icon size={12} strokeWidth={1.75} />}>
      {label}
    </Badge>
  );
}
