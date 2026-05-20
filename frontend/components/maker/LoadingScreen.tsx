'use client';

interface Props {
  message: string;
}

export default function LoadingScreen({ message }: Props) {
  return (
    <div className="min-h-[calc(100vh-72px)] flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 rounded-full border-[3px] border-lavender-mid border-t-navy animate-spin" />
      <p className="text-sm text-ink-muted">{message}</p>
    </div>
  );
}
