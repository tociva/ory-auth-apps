export type AdminShellNavChild = Readonly<{ label: string; path: string }>;

export type AdminShellNavGroup = Readonly<{
  label: string;
  subtitle: string;
  key: string;
  children: readonly AdminShellNavChild[];
}>;
