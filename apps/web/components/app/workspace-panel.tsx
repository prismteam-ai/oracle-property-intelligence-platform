import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function WorkspacePanel({
  title,
  children,
  className,
  contentClassName,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}): React.ReactElement {
  return (
    <Card className={cn("rounded-md border-border/80 bg-card/90", className)}>
      <CardHeader className="border-b border-border/60 px-5 py-4">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className={cn("px-5 py-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
