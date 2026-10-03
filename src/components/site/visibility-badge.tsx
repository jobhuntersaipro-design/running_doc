import { Globe, Lock } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";

/** Who can see a race: built in, added by the admin (public), a runner's race made public (published), or private to its runner. */
export type Visibility = "built-in" | "public" | "published" | "private";

export const visibilityOf = (r: { builtIn: boolean; owner?: string; publishedBy?: string }): Visibility =>
  r.builtIn ? "built-in" : !r.owner ? "public" : r.publishedBy ? "published" : "private";

const LOOK: Record<Visibility, { tone: BadgeTone; label: string; icon?: typeof Lock }> = {
  "built-in": { tone: "info", label: "Built in" },
  public: { tone: "success", label: "Public", icon: Globe },
  published: { tone: "success", label: "Published", icon: Globe },
  private: { tone: "neutral", label: "Private", icon: Lock },
};

/** The race's visibility as an Arc badge: green when everyone can see it, grey when private. */
export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const { tone, label, icon: Icon } = LOOK[visibility];
  return (
    <Badge tone={tone} size="sm" icon={Icon ? <Icon size={12} strokeWidth={1.75} /> : undefined}>
      {label}
    </Badge>
  );
}
