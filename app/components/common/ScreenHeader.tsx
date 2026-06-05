export type ScreenHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
};

export function ScreenHeader({ eyebrow, title, subtitle, action }: ScreenHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="grid gap-1">
        <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">{title}</h1>
        <p className="max-w-2xl text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

